import { describe, expect, it } from "vitest";
import {
  buildCommercialIntentPrompt,
  buildKeywordPrompt,
  buildMetadataPrompt,
  buildRejectPrompt,
  buildScoringPrompt
} from "@/lib/extension/prompts";

/**
 * Uji penahan — bukan lagi uji paritas.
 *
 * Dulu konstanta di bawah ini salinan VERBATIM dari `nerona_medata/content.js`,
 * dan gunanya menangkap penyimpangan antara dua salinan prompt. Salinan di
 * extension sudah tidak ada (`grep "Microstock Metadata Generator" content.js`
 * kosong), jadi yang tersisa satu pekerjaan: membuat perubahan prompt yang TIDAK
 * disengaja menggagalkan uji.
 *
 * Itu tetap pekerjaan yang layak — prompt ini bekerja dan tidak boleh berubah
 * sebagai efek samping beres-beres. Tapi artinya berbeda: gagalnya uji ini bukan
 * "dua berkas menyimpang", melainkan "prompt berubah — apakah memang disengaja?".
 * Kalau ya, teks di bawah ikut diperbarui bersama prompt-nya, dalam commit yang
 * sama.
 */

const METADATA_GENERATOR_PROMPT_QUICK = `You are an AI Microstock Metadata Generator.
Analyze the image. Generate optimized stock metadata from VISIBLE content only. English.
First identify what is HAPPENING in it (the action, interaction, or process shown) and what the asset is FOR (its use case and the occasion it suits), then how it looks.
Target style: Adobe Stock, Shutterstock, Magnific, Canva, Etsy.

Return JSON only (no markdown):
{"title":"","description":"","keywords":[]}

title: clear, commercial, SEO-friendly, natural; max 180 chars.
description: short commercial copy (subject, activity, style, use); max 300 chars.
keywords: exactly 50 strings, most important first; image-relevant only—verb-led phrases for what is happening, use-case and occasion phrases for what the asset is for, subject, industry, emotion, style, color, composition, business/niche; mix primary, long-tail, semantic.
Prioritize commercial intent and buyer search. No spam, duplicates, unrelated or misleading tags.
Do NOT invent locations, brands, events, identities, statistics, or copyrighted terms.
Keywords must be readable English only—no random hashes, placeholder tags, URLs, JSON artifacts, or offensive language.`;

const METADATA_GENERATOR_PROMPT_ADVANCED = `You are an expert AI Microstock Metadata Generator for commercial stock libraries.

Analyze the image in depth. Generate highly optimized, buyer-focused metadata from VISIBLE content only. English.
Target marketplaces: Adobe Stock, Shutterstock, Magnific, Canva, Etsy.

Return JSON only (no markdown):
{"title":"","description":"","keywords":[],"visualBrief":"","categories":[]}

Before writing metadata, internally identify, IN THIS ORDER: (1) what is HAPPENING — the action, interaction, or process shown, stated as a verb; (2) what the asset is FOR — its use case, the occasion or campaign it suits, the document or product type it works as; (3) then primary subject, secondary elements, setting, mood, color palette, lighting, composition type, medium/style (photo, vector, 3D, illustration), industry/niche, target buyers, seasonal/trend signals (only if visible).
If the image is a design template rather than a photograph, (1) and (2) matter most: describe what a buyer would use it to make, not the shapes and gradients it is made of.

title: commercial, SEO-friendly, specific to this image; max 180 chars; avoid generic filler.
description: persuasive commercial copy—what is happening, what it is for, subject, context, style; max 300 chars.
keywords: exactly 50 strings, ordered by buyer search intent + image specificity. Include verb-led phrases for what is happening, use-case and occasion phrases for what the asset is for, core subject, synonyms, activities, emotions, industries, demographics (only if visible), colors, composition, technique, season/holiday only if evident, and long-tail phrases (2–4 words). Mix head terms and long-tail. No duplicates, spam, misleading tags, copyrighted brands, celebrity names, or invented facts.
visualBrief: 2–3 sentences on what is happening and what is visible (for grounding).
categories: 3–8 broad stock categories that match the image.

Prioritize commercial intent and buyer search behavior.
Keywords must be readable English only—no random hashes, placeholder tags, URLs, JSON artifacts, or offensive language.`;

const VECTEEZY_HINT =
  " Vecteezy: title must be a detailed descriptive phrase (about 8–14 words, max 200 chars)—subject, style, colors, composition, use case; unique per image. Keywords: maximum 50 tags, single readable English words (letters a-z, optional digits); never use standalone conjunctions/prepositions (for, to, with, at, in, on, of, by, and, or, the, a, an) as tags; image-specific search terms only; no random hashes, offensive language, or placeholder tags.";
const MIRICANVAS_HINT =
  " Miricanvas: Element Name max 100 chars. Keywords: maximum 25 tags only—one readable word or short phrase per tag; image-specific search terms; no duplicates or placeholder tags.";
function batchIndexHint(batchIndex: number) {
  return ` Batch item ${batchIndex + 1} — title and keywords must be unique to THIS image only (not reusable from other assets).`;
}

function expectedMetadataPrompt(opts: {
  mode: "quick" | "advanced";
  marketplace: string;
  hint: string;
  batchHint: string;
}) {
  const base =
    opts.mode === "advanced" ? METADATA_GENERATOR_PROMPT_ADVANCED : METADATA_GENERATOR_PROMPT_QUICK;
  return `${base}
Context marketplace: ${opts.marketplace}.${opts.hint}${opts.batchHint}`.trim();
}

const METADATA_CAPS = {
  quick: 720,
  advanced: 1200
};

describe("buildMetadataPrompt", () => {
  const marketplaces: Array<{ label: string; hint: string }> = [
    { label: "Vecteezy", hint: VECTEEZY_HINT },
    { label: "Miricanvas", hint: MIRICANVAS_HINT },
    { label: "Adobe Stock", hint: "" }
  ];
  const modes: Array<"quick" | "advanced"> = ["quick", "advanced"];

  for (const mode of modes) {
    for (const mp of marketplaces) {
      for (const withBatch of [false, true]) {
        const label = `mode=${mode} marketplace=${mp.label} batchIndex=${withBatch ? "present" : "absent"}`;
        it(`metadata prompt matches the pinned text (${label})`, () => {
          const batchIndex = withBatch ? 2 : undefined;
          const { prompt, maxTokens } = buildMetadataPrompt({
            marketplace: mp.label,
            promptMode: mode,
            batchIndex
          });
          const expected = expectedMetadataPrompt({
            mode,
            marketplace: mp.label,
            hint: mp.hint,
            batchHint: withBatch ? batchIndexHint(2) : ""
          });
          expect(prompt).toBe(expected);
          expect(maxTokens).toBe(METADATA_CAPS[mode]);
        });
      }
    }
  }

  it("defaults promptMode to advanced when omitted", () => {
    const { prompt, maxTokens } = buildMetadataPrompt({ marketplace: "Adobe Stock" });
    expect(prompt).toBe(
      expectedMetadataPrompt({ mode: "advanced", marketplace: "Adobe Stock", hint: "", batchHint: "" })
    );
    expect(maxTokens).toBe(1200);
  });

  it("ignores a negative batchIndex", () => {
    const { prompt } = buildMetadataPrompt({
      marketplace: "Adobe Stock",
      promptMode: "quick",
      batchIndex: -1
    });
    expect(prompt).toBe(
      expectedMetadataPrompt({ mode: "quick", marketplace: "Adobe Stock", hint: "", batchHint: "" })
    );
  });
});

const AI_SCORING_AGENT_PROMPT = `You are an AI Microstock Scoring Agent specialized in analyzing images for stock marketplaces such as Adobe Stock, Magnific, Shutterstock, Canva, Etsy, and AI-generated commercial assets.

==================================================
OBJECTIVE
==================================================

Analyze uploaded images and estimate their commercial marketplace potential based ONLY on:

- visual content
- composition
- aesthetics
- semantic meaning
- trend alignment
- stock usability
- commercial relevance

You are NOT a real-time marketplace analytics database.

You must behave like a professional stock marketplace intelligence engine using visual-commercial reasoning and semantic inference.

==================================================
CORE RESPONSIBILITIES
==================================================

Analyze and estimate:

- commercial potential
- trend relevance
- marketplace usability
- visual quality
- originality
- saturation probability
- thumbnail click potential
- buyer intent
- keyword opportunities
- stock suitability

==================================================
ANALYSIS REQUIREMENTS
==================================================

Analyze:

1. Main subject
2. Visual style
3. Composition quality
4. Commercial usability
5. Emotional tone
6. Marketplace suitability
7. Trend alignment
8. AI-generation quality
9. Visual uniqueness
10. Saturation probability

==================================================
SCORING SYSTEM
==================================================

Generate estimated scores from 0-100:

- CommercialIntentScore
- TrendRelevanceScore
- StockUsabilityScore
- VisualQualityScore
- OriginalityScore
- SaturationRiskScore
- ThumbnailCTRScore
- OverallOpportunityScore

==================================================
SCORING LOGIC
==================================================

High score indicators:
- clear subject
- commercial/business usability
- modern aesthetic
- clean composition
- editable copy space
- realistic emotion
- strong visual hierarchy
- current design trends
- niche specificity
- high thumbnail clarity

Low score indicators:
- oversaturated concepts
- generic AI appearance
- distorted anatomy
- unclear purpose
- weak composition
- excessive clutter
- repetitive stock concepts
- poor commercial relevance

==================================================
SATURATION DETECTION
==================================================

Estimate whether image resembles:
- generic AI office scenes
- repetitive laptop workspace renders
- overused business visuals
- duplicated Pinterest aesthetics
- repetitive Canva styles
- common AI-generated compositions

Estimate saturation probability using visual-semantic similarity.

==================================================
COMMERCIAL INTENT ANALYSIS
==================================================

Estimate likely buyer demand for:
- advertising
- SaaS
- ecommerce
- education
- finance
- healthcare
- startup branding
- social media
- presentation slides
- Canva templates
- websites
- marketing campaigns

==================================================
TREND ANALYSIS
==================================================

Estimate alignment with:
- Canva trends
- Pinterest aesthetics
- startup branding visuals
- modern ecommerce design
- Gen Z design language
- UGC-style content
- minimalist branding
- AI business visuals
- social media trends

==================================================
KEYWORD GENERATION
==================================================

Generate:
- primary keywords
- long-tail keywords
- semantic keyword clusters
- SEO-friendly stock tags

Prioritize:
- specific
- commercial
- searchable
- marketplace-friendly keywords

Avoid:
- generic spam keywords

==================================================
DATA RELIABILITY RULES
==================================================

You MUST NOT invent:
- fake search volume
- fake competition counts
- fake downloads
- fake engagement metrics
- fake trend percentages
- fake marketplace statistics

If real marketplace data is NOT provided:
- clearly treat scores as estimated inference
- use visual-semantic reasoning only
- avoid pretending to know exact statistics
- remain transparent about uncertainty

==================================================
ESTIMATION MODE
==================================================

If only image input is available:

Use:
- visual analysis
- semantic understanding
- composition analysis
- commercial heuristics
- trend-style recognition
- marketplace pattern recognition

DO NOT claim:
- exact search volume
- exact competition asset counts
- exact sales prediction
- exact marketplace ranking

Use terms like:
- likely
- estimated
- inferred
- visually suggests
- potentially aligned with
- probable commercial usage
- estimated saturation risk

==================================================
CONFIDENCE HANDLING
==================================================

If confidence is low:
- reduce certainty
- explain ambiguity
- avoid overconfident conclusions

Good example:
"Image appears visually similar to common AI business stock imagery, therefore estimated saturation risk is moderate to high."

Bad example:
"This image has exactly 87,000 competitors."

==================================================
OUTPUT FORMAT
==================================================

Return JSON only (no markdown fences).

{
  "image_summary": "",
  "detected_subjects": [],
  "visual_style": [],
  "scores": {
    "overall_opportunity": 0,
    "commercial_intent": 0,
    "trend_relevance": 0,
    "stock_usability": 0,
    "visual_quality": 0,
    "originality": 0,
    "saturation_risk": 0,
    "thumbnail_ctr": 0
  },
  "market_analysis": {
    "commercial_strength": "",
    "trend_alignment": "",
    "market_saturation": "",
    "buyer_potential": "",
    "best_use_cases": []
  },
  "recommendations": {
    "should_upload": true,
    "priority_level": "",
    "best_marketplaces": [],
    "best_content_categories": [],
    "improvement_suggestions": [],
    "recommended_variations": []
  },
  "keywords": {
    "primary": [],
    "long_tail": [],
    "semantic_clusters": [],
    "avoid_keywords": []
  },
  "risk_analysis": {
    "ai_detection_risk": "",
    "duplicate_style_risk": "",
    "rejection_risk": ""
  }
}

==================================================
FINAL PRINCIPLE
==================================================

You are an AI inference engine,
NOT a real-time marketplace analytics database.

Your responsibility is:
- intelligent estimation
- visual-commercial reasoning
- semantic trend analysis
- stock usability evaluation
- saturation estimation
- keyword opportunity generation

while remaining transparent about uncertainty.`.trim();

describe("buildScoringPrompt", () => {
  it("matches the extension's exact scoring prompt", () => {
    const { prompt, maxTokens } = buildScoringPrompt({ marketplace: "Adobe Stock" });
    expect(prompt).toBe(
      `${AI_SCORING_AGENT_PROMPT}

Context: analyzing for contributor upload on Adobe Stock.
Return JSON only.`
    );
    expect(maxTokens).toBe(2200);
  });
});

const COMMERCIAL_INTENT_ANALYZER_PROMPT = `You are a Commercial Intent Analyzer for stock/contributor imagery.

OBJECTIVE:
Analyze the image and explain WHAT this image is commercially FOR — who would buy it, for which campaigns, industries, channels, and buyer problems it solves.

Focus on commercial purpose and usage intent, NOT generic quality scoring.

Use cautious language (likely, appears suited for, estimated) — you do not have real marketplace analytics.

Return JSON only (no markdown fences):
{
  "image_summary": "",
  "primary_commercial_intent": "",
  "intent_confidence": "low|medium|high",
  "buyer_personas": [{"persona":"","why_they_buy":""}],
  "industries": [],
  "campaign_types": [],
  "marketing_channels": [],
  "emotional_triggers": [],
  "message_themes": [],
  "seasonal_timing": {"relevance":"","notes":""},
  "content_format_fit": [],
  "not_suitable_for": [],
  "competing_visual_cliches": [],
  "metadata_angle": {
    "title_direction": "",
    "description_angle": "",
    "keyword_themes": []
  },
  "disclaimer": ""
}

Rules:
- English only for JSON string values
- primary_commercial_intent: one concise label (e.g. "Corporate teamwork hero for SaaS landing pages")
- buyer_personas: 2-4 items
- industries, campaign_types, marketing_channels: 3-8 items each when possible
- keyword_themes: 8-20 short themes (not full keyword spam)`.trim();

describe("buildCommercialIntentPrompt", () => {
  it("matches the extension's exact commercial-intent prompt", () => {
    const { prompt, maxTokens } = buildCommercialIntentPrompt({ marketplace: "Adobe Stock" });
    expect(prompt).toBe(
      `${COMMERCIAL_INTENT_ANALYZER_PROMPT}

Context: contributor asset for Adobe Stock.
Explain what this image is FOR commercially (buyers, campaigns, channels).
Return JSON only.`
    );
    expect(maxTokens).toBe(2000);
  });
});

const MICROSTOCK_EVENT_KEYWORD_RESEARCH_PROMPT = `You are an AI Microstock Trend & Event Keyword Researcher.

Your task:
Research high-potential microstock content opportunities for:
- current month
- next month

Target marketplaces:
Adobe Stock, Shutterstock, Magnific, Canva, Etsy.

Return JSON only:
{
  "current_month": [],
  "next_month": []
}

Each item format:
{
  "event": "",
  "search_intent": "",
  "content_ideas": [],
  "high_value_keywords": [],
  "commercial_use_cases": [],
  "trend_score": 0,
  "competition_level": "",
  "recommended_styles": []
}

Rules:
- Focus on commercially valuable and searchable events
- Include:
  - holidays
  - seasonal moments
  - business trends
  - global awareness days
  - shopping moments
  - social media trends
  - education/business/calendar events
- Prioritize:
  - high demand
  - low/moderate competition
  - evergreen + seasonal combination
- Keywords must be:
  - SEO-friendly
  - buyer-oriented
  - microstock optimized
  - commercially relevant

Content ideas should include:
- photo concepts
- illustration concepts
- background/banner ideas
- social media templates
- marketing materials
- print-on-demand opportunities

Commercial use cases examples:
- advertising
- social media
- website banner
- presentation
- ecommerce
- invitation
- packaging
- education

Trend score:
0-100 based on commercial potential.

Competition level:
- low
- medium
- high

Recommended styles examples:
- minimal
- flat design
- realistic
- 3D render
- watercolor
- modern corporate
- luxury
- pastel
- dark mode
- AI generated look

Avoid:
- copyrighted topics
- trademarked brands
- unsafe content
- misleading trends`;

describe("buildKeywordPrompt", () => {
  it("matches the extension's exact keyword-research prompt", () => {
    const { prompt, maxTokens } = buildKeywordPrompt({
      marketplace: "microstock",
      monthsCurrent: "July 2026",
      monthsNext: "August 2026",
      referenceDate: "2026-07-24"
    });
    expect(prompt).toBe(
      `${MICROSTOCK_EVENT_KEYWORD_RESEARCH_PROMPT}

Context:
- Today's reference date: 2026-07-24
- current_month label: July 2026
- next_month label: August 2026
- Contributor focus marketplace: microstock

Provide 6-10 strong opportunities per month array. Return JSON only.`.trim()
    );
    expect(maxTokens).toBe(4800);
  });

  it("defaults referenceDate to today (server) when omitted", () => {
    const { prompt } = buildKeywordPrompt({
      marketplace: "microstock",
      monthsCurrent: "July 2026",
      monthsNext: "August 2026"
    });
    const today = new Date().toISOString().slice(0, 10);
    expect(prompt).toContain(`- Today's reference date: ${today}`);
  });
});

describe("buildRejectPrompt", () => {
  it("matches the extension's exact reject-analyzer prompt with a context snippet", () => {
    const { prompt, maxTokens } = buildRejectPrompt({
      marketplace: "Adobe Stock",
      contextSnippet: "  Rejected: Low quality  "
    });
    expect(prompt).toBe(
      `
You are an expert stock marketplace reviewer assistant for Adobe Stock.
The contributor indicates this asset was REJECTED or NOT ACCEPTED by the marketplace UI.

Task:
1) Use the image + the on-page context text (may be partial/noisy) to infer plausible rejection drivers.
2) Propose safer, compliant metadata direction (title/description/keywords) WITHOUT spam or misleading claims.
3) Be explicit when you are guessing vs when the UI text clearly states a reason.

Return JSON only (no markdown fences, no commentary). Use this exact schema:
{
  "summary": "string",
  "evidenceFromPage": ["string"],
  "likelyRejectionReasons": [{"reason":"string","confidence":"low|medium|high","mitigation":"string"}],
  "suggestedTitle": "string",
  "suggestedDescription": "string",
  "suggestedKeywords": ["string"],
  "legalAndIpNotes": ["string"],
  "technicalQualityNotes": ["string"],
  "disclaimer": "string"
}

Rules:
- English only for JSON string values
- suggestedKeywords: 12–40 items; no marketplace names; avoid banned/spam patterns
- disclaimer must state you are not the marketplace and final decision is unknown

On-page context (trimmed):
Rejected: Low quality
`.trim()
    );
    expect(maxTokens).toBe(1024);
  });

  it("uses (none) when contextSnippet is empty", () => {
    const { prompt } = buildRejectPrompt({ marketplace: "Adobe Stock", contextSnippet: "" });
    expect(prompt.endsWith("On-page context (trimmed):\n(none)")).toBe(true);
  });
});
