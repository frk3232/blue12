import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getTrafficInsight(trafficData: any) {
  const model = "gemini-3-flash-preview";
  const prompt = `You are a Traffic Logistics Expert. Analyze this traffic data and current time to predict if the route will stay Green or turn Red within 30 minutes. Suggest the most efficient, safe path.
  
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
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return {
      is_predicted_jam: false,
      recommendation_text: "Unable to generate AI insight at this time.",
    };
  }
}
