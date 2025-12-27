import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY;

export const generateMotivation = async (identity: string, region: string): Promise<string> => {
  if (!apiKey) {
    return "祝您金榜題名，考試順利！";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Create a context-aware prompt based on identity and region
    let prompt = `請為一位來自 ${region} 的 ${identity} 寫一句關於國中會考的暖心鼓勵語或祝福（不超過 30 字）。`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Speed over reasoning
      }
    });

    return response.text?.trim() || "相信自己，你的努力終將開花結果！";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "保持專注，夢想就在前方！";
  }
};