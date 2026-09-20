import { z } from "zod";
import type { ResumeAnalysis } from "../shared/analysis.js";

const resultSchema = z.object({ score: z.number().int().min(0).max(100), matchedKeywords: z.array(z.string()).max(15), missingKeywords: z.array(z.string()).max(15), suggestions: z.array(z.string()).min(3).max(5) });
export interface ResumeAnalyzer { analyzeResume(resume: string, jobDescription: string): Promise<ResumeAnalysis>; }
const keywords = (text: string) => [...new Set((text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) ?? []).filter(word => !new Set(["the","and","with","that","for","you","our","are","will","this","from","your","have","years","role","team","work","skills"]).has(word)))].slice(0, 40);
export class OpenAICompatibleAnalyzer implements ResumeAnalyzer {
  async analyzeResume(resume: string, jobDescription: string): Promise<ResumeAnalysis> {
    const prompt = `Compare this resume to this job description. Return ONLY JSON matching: {score: integer 0-100, matchedKeywords: string[], missingKeywords: string[], suggestions: string[]} with 3-5 specific resume bullet tweaks.\n\nRESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jobDescription}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }) });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const body = await response.json() as { choices?: { message?: { content?: string } }[] }; const raw = body.choices?.[0]?.message?.content;
    const parsed = resultSchema.parse(JSON.parse(raw ?? "")); return { ...parsed, provider: "openai", createdAt: new Date().toISOString() };
  }
}
export class LocalAnalyzer implements ResumeAnalyzer {
  async analyzeResume(resume: string, jobDescription: string): Promise<ResumeAnalysis> { const resumeWords = new Set(keywords(resume)); const jobWords = keywords(jobDescription); const matchedKeywords = jobWords.filter(word => resumeWords.has(word)).slice(0, 10); const missingKeywords = jobWords.filter(word => !resumeWords.has(word)).slice(0, 8); const score = Math.min(100, Math.round((matchedKeywords.length / Math.max(jobWords.length, 1)) * 100)); return { score, matchedKeywords, missingKeywords, suggestions: missingKeywords.slice(0, 3).map(keyword => `Add a results-focused bullet that shows your experience with ${keyword}.`).concat(["Lead each relevant bullet with an action verb and quantify its impact where possible."]).slice(0, 4), provider: "local-demo", createdAt: new Date().toISOString() }; }
}
export async function analyzeWithRetry(resume: string, jobDescription: string, analyzer: ResumeAnalyzer = process.env.OPENAI_API_KEY ? new OpenAICompatibleAnalyzer() : new LocalAnalyzer()) { let error: unknown; for (let attempt = 0; attempt < 2; attempt++) try { return await analyzer.analyzeResume(resume, jobDescription); } catch (caught) { error = caught; } throw error; }
