import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Autocomplete, Marker } from '@react-google-maps/api';
import { GoogleGenAI } from "@google/genai";
import { 
  Search, 
  MapPin, 
  AlertTriangle, 
  Navigation, 
  Clock, 
  Shield, 
  TrendingUp, 
  Info, 
  LogOut, 
  LogIn, 
  ChevronRight,
  Menu,
  X,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc,
  getDoc,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { cn } from './lib/utils';

// --- Types ---
interface SafetyHotspot {
  id: string;
  locationName: string;
  coordinates: { lat: number; lng: number };
  riskLevel: 'Low' | 'Med' | 'High';
}

interface AIInsight {
  is_predicted_jam: boolean;
  recommendation_text: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

// --- Utils ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Constants ---
const LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];
const KOCHI_COORDS = { lat: 9.9312, lng: 76.2673 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

// --- Main Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [destination, setDestination] = useState<string>('');
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [hotspots, setHotspots] = useState<SafetyHotspot[]>([]);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<SafetyHotspot | null>(null);

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES
  });

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // Ensure user profile exists
        const userDoc = doc(db, 'users', currentUser.uid);
        getDoc(userDoc).then((docSnap) => {
          if (!docSnap.exists()) {
            setDoc(userDoc, {
              uid: currentUser.uid,
              email: currentUser.email,
              role: 'user',
              createdAt: serverTimestamp()
            }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${currentUser.uid}`));
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'safety_hotspots'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyHotspot));
      setHotspots(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'safety_hotspots'));

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // --- Connection Test ---
  useEffect(() => {
    async function testConnection() {
      let retries = 3;
      while (retries > 0) {
        try {
          await getDocFromServer(doc(db, 'test', 'connection'));
          break;
        } catch (error) {
          if (error instanceof Error && error.message.includes('the client is offline')) {
            console.warn("Firestore connection attempt failed. Retrying...");
            retries--;
            await new Promise(r => setTimeout(r, 2000));
          } else {
            break;
          }
        }
      }
    }
    testConnection();
  }, []);

  // --- Admin Seeding ---
  useEffect(() => {
    if (user?.email === "fadlur775@gmail.com") {
      const seedHotspots = async () => {
        const hotspotsRef = collection(db, 'safety_hotspots');
        const snapshot = await getDoc(doc(hotspotsRef, 'kochi_junction'));
        if (!snapshot.exists()) {
          const initialSpots = [
            { id: 'kochi_junction', locationName: 'Vyttila Junction', coordinates: { lat: 9.9667, lng: 76.3167 }, riskLevel: 'High' },
            { id: 'edappally', locationName: 'Edappally Bypass', coordinates: { lat: 10.0250, lng: 76.3083 }, riskLevel: 'Med' },
            { id: 'mg_road', locationName: 'MG Road North', coordinates: { lat: 9.9833, lng: 76.2833 }, riskLevel: 'Low' }
          ];
          for (const spot of initialSpots) {
            const { id, ...data } = spot;
            await setDoc(doc(hotspotsRef, id), data);
          }
        }
      };
      seedHotspots();
    }
  }, [user]);

  // --- Handlers ---
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      console.log("Place selected:", place);
      if (place) {
        const target = place.formatted_address || place.name;
        if (target) {
          setDestination(target);
          calculateRoute(target);
        }
      }
    }
  };

  const calculateRoute = async (dest: string) => {
    if (!dest || !isLoaded) return;
    setIsLoading(true);
    setAiInsight(null);

    const directionsService = new google.maps.DirectionsService();
    
    const performRouting = async (origin: google.maps.LatLngLiteral | string) => {
      try {
        console.log("Calculating route from", origin, "to", dest);
        const result = await directionsService.route({
          origin,
          destination: dest,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: true
        });

        console.log("Route result:", result);
        if (result.status === 'OK') {
          console.log("Setting directions state", result);
          setDirections(result);
          await processAiInsight(result);
          logTraffic(result);
        } else {
          console.error("Directions request failed with status:", result.status);
        }
      } catch (error) {
        console.error("Route Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
          performRouting(origin);
        },
        (error) => {
          console.error("Geolocation Error:", error);
          console.warn("Falling back to default origin (Kochi)");
          performRouting(KOCHI_COORDS);
        },
        { timeout: 5000 }
      );
    } else {
      console.warn("Geolocation not supported. Falling back to default origin (Kochi)");
      performRouting(KOCHI_COORDS);
    }
  };

  const processAiInsight = async (result: google.maps.DirectionsResult) => {
    const route = result.routes[0].legs[0];
    const trafficData = {
      distance: route.distance?.text,
      duration: route.duration?.text,
      duration_in_traffic: route.duration_in_traffic?.text,
      steps: route.steps.length,
      destination: route.end_address
    };

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const model = "gemini-3-flash-preview";
    const prompt = `You are a Traffic Logistics Expert. Analyze this traffic data for a route in Kerala (Kochi/Trivandrum) and current time to predict if the route will stay Green or turn Red within 30 minutes. Suggest the most efficient, safe path.
    
    Traffic Data: ${JSON.stringify(trafficData)}
    Current Time: ${new Date().toLocaleTimeString()}
    
    Return a JSON object with:
    {
      "is_predicted_jam": boolean,
      "recommendation_text": string
    }`;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const insight = JSON.parse(response.text || "{}");
      setAiInsight(insight);
    } catch (error) {
      console.error("AI Error:", error);
    }
  };

  const logTraffic = async (result: google.maps.DirectionsResult) => {
    if (!user) return;
    const route = result.routes[0].legs[0];
    try {
      await addDoc(collection(db, 'traffic_logs'), {
        routeId: result.routes[0].summary,
        currentTravelTime: route.duration?.value || 0,
        timestamp: serverTimestamp(),
        userId: user.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'traffic_logs');
    }
  };

  // --- Render Helpers ---
  if (!isLoaded) return <div className="flex items-center justify-center h-screen bg-slate-50">Loading Map...</div>;
  if (loadError) return <div className="flex items-center justify-center h-screen bg-slate-50">Error loading map: {loadError.message}</div>;

  console.log("Rendering App, directions present:", !!directions);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 380 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="bg-white border-r border-slate-200 flex flex-col shadow-xl z-20 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Zap size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">Blue1</h1>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">Proactive Mobility</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Auth Section */}
          {!user ? (
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 space-y-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Secure Access</h3>
                <p className="text-sm text-slate-500">Sign in to save destinations and receive personalized AI insights.</p>
              </div>
              <button 
                onClick={handleLogin}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-100"
              >
                <LogIn size={18} />
                Sign in with Google
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                <div>
                  <p className="text-sm font-bold text-slate-800">{user.displayName}</p>
                  <p className="text-xs text-slate-500">Active Commuter</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-white rounded-lg text-slate-400 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          )}

          {/* Search Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Search size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Plan Your Route</span>
            </div>
            <div className="relative">
              <Autocomplete
                onLoad={(ref) => (autocompleteRef.current = ref)}
                onPlaceChanged={onPlaceChanged}
                fields={['formatted_address', 'geometry', 'name']}
              >
                <input
                  type="text"
                  placeholder="Where are you heading?"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all shadow-sm text-slate-700 font-medium"
                />
              </Autocomplete>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
                <MapPin size={20} />
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <AnimatePresence>
            {aiInsight && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={cn(
                  "p-6 rounded-2xl border shadow-sm space-y-4",
                  aiInsight.is_predicted_jam 
                    ? "bg-amber-50 border-amber-100" 
                    : "bg-emerald-50 border-emerald-100"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "flex items-center gap-2 font-bold text-sm",
                    aiInsight.is_predicted_jam ? "text-amber-700" : "text-emerald-700"
                  )}>
                    {aiInsight.is_predicted_jam ? <AlertTriangle size={18} /> : <Zap size={18} />}
                    AI Forecast
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-50">30m Prediction</div>
                </div>
                <p className="text-sm leading-relaxed text-slate-700 font-medium">
                  {aiInsight.recommendation_text}
                </p>
                <div className="flex items-center gap-4 pt-2 border-t border-slate-200/50">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                    <Clock size={14} />
                    {directions?.routes[0].legs[0].duration?.text}
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                    <TrendingUp size={14} />
                    {directions?.routes[0].legs[0].distance?.text}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Safety Hotspots Summary */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <div className="flex items-center gap-2">
                <Shield size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Safety Hotspots</span>
              </div>
              <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full font-bold">{hotspots.length} Zones</span>
            </div>
            <div className="space-y-3">
              {hotspots.slice(0, 3).map(spot => (
                <div 
                  key={spot.id}
                  className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 transition-all cursor-pointer group"
                  onClick={() => setActiveHotspot(spot)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      spot.riskLevel === 'High' ? "bg-red-500 animate-pulse" : 
                      spot.riskLevel === 'Med' ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                    <span className="text-sm font-semibold text-slate-700">{spot.locationName}</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200">
          <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest">
            Powered by Gemini 1.5 Flash & Google Maps
          </p>
        </div>
      </motion.aside>

      {/* Main Map Area */}
      <main className="flex-1 relative">
        {/* Map Controls */}
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
          {!isSidebarOpen && (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-4 bg-white rounded-2xl shadow-xl text-slate-700 hover:bg-slate-50 transition-all border border-slate-200"
            >
              <Menu size={24} />
            </button>
          )}
        </div>

        {/* Map Overlay Info */}
        <AnimatePresence>
          {activeHotspot && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-6 right-6 z-10 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className={cn(
                "h-2",
                activeHotspot.riskLevel === 'High' ? "bg-red-500" : 
                activeHotspot.riskLevel === 'Med' ? "bg-amber-500" : "bg-emerald-500"
              )} />
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">{activeHotspot.locationName}</h3>
                  <button onClick={() => setActiveHotspot(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex items-center gap-2 py-1 px-3 bg-slate-50 rounded-full w-fit">
                  <AlertTriangle size={14} className={cn(
                    activeHotspot.riskLevel === 'High' ? "text-red-500" : 
                    activeHotspot.riskLevel === 'Med' ? "text-amber-500" : "text-emerald-500"
                  )} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {activeHotspot.riskLevel} Risk Area
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This location is marked as a safety hotspot. Exercise caution when driving through this zone, especially during peak hours.
                </p>
                <button className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors">
                  View Details
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-white/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-slate-100">
              <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
              <div className="text-center">
                <p className="font-bold text-slate-800">Analyzing Route</p>
                <p className="text-xs text-slate-500">Gemini AI is predicting traffic trends...</p>
              </div>
            </div>
          </div>
        )}

        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={KOCHI_COORDS}
          zoom={12}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            styles: [
              {
                "featureType": "administrative",
                "elementType": "labels.text.fill",
                "stylers": [{ "color": "#444444" }]
              },
              {
                "featureType": "landscape",
                "elementType": "all",
                "stylers": [{ "color": "#f2f2f2" }]
              },
              {
                "featureType": "poi",
                "elementType": "all",
                "stylers": [{ "visibility": "off" }]
              },
              {
                "featureType": "road",
                "elementType": "all",
                "stylers": [{ "saturation": -100 }, { "lightness": 45 }]
              },
              {
                "featureType": "road.highway",
                "elementType": "all",
                "stylers": [{ "visibility": "simplified" }]
              },
              {
                "featureType": "road.arterial",
                "elementType": "labels.icon",
                "stylers": [{ "visibility": "off" }]
              },
              {
                "featureType": "transit",
                "elementType": "all",
                "stylers": [{ "visibility": "off" }]
              },
              {
                "featureType": "water",
                "elementType": "all",
                "stylers": [{ "color": "#c8d7d4" }, { "visibility": "on" }]
              }
            ]
          }}
        >
          {directions && <DirectionsRenderer directions={directions} />}
          
          {hotspots.map(spot => (
            <Marker
              key={spot.id}
              position={spot.coordinates}
              onClick={() => setActiveHotspot(spot)}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: spot.riskLevel === 'High' ? '#ef4444' : spot.riskLevel === 'Med' ? '#f59e0b' : '#10b981',
                fillOpacity: 0.8,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 8
              }}
            />
          ))}
        </GoogleMap>

        {/* Floating Action Buttons */}
        <div className="absolute bottom-8 right-8 flex flex-col gap-4">
          <button 
            onClick={() => {
              // Recenter map
              navigator.geolocation.getCurrentPosition(pos => {
                // This would need a map ref to panTo
              });
            }}
            className="w-14 h-14 bg-white rounded-2xl shadow-2xl flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all border border-slate-200"
          >
            <Navigation size={24} />
          </button>
        </div>
      </main>
    </div>
  );
}
