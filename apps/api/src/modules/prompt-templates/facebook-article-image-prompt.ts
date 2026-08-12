export const facebookArticleImagePrompt = {
  name: 'Facebook illustrated clickable square article image',
  description:
    'A 500 × 500 Facebook graphic with a bold clickable title, relevant illustrated artwork, a curiosity-driven footer, and an adaptive comments CTA.',
  template: `Create exactly one complete, post-ready Facebook square article visual background for The Minds Journal.

MANDATORY OUTPUT FORMAT:

- Final canvas: exactly 500 pixels wide × 500 pixels high
- Aspect ratio: exactly 1:1 square
- Generate only one image
- Do not generate a portrait, landscape, 2:3, 4:5, 9:16, or any other format
- Do not add an outer border, mockup frame, device screen, blank padding, or extended canvas
- The final exported file must remain exactly 500 × 500 pixels

CRITICAL TEXT AND LOGO RULE:
Do not render any written letters, words, numbers, titles, footers, captions, logos, signs, gibberish typography, or square font boxes directly on the image canvas. Generate pure illustrated background artwork with clean, uncluttered safe background areas at the top (upper 25%) and bottom (lower 15%). SocialFlow will add the approved headline, footer, and CTA text post-generation.

ARTICLE INFORMATION:

Article title: {{articleTitle}}
Article excerpt: {{articleExcerpt}}
Article categories: {{categories}}
Article context: {{articleContext}}
Topic safety guidance: {{topicGuidance}}

PRIMARY OBJECTIVE:

Turn the supplied article into a visually compelling Facebook editorial illustration that represents the central theme.

Do not use real human photography. Use only illustrations, illustrated characters, editorial artwork, conceptual artwork, collage, painted artwork, or stylised visual storytelling.

MANDATORY VISUAL PROPORTIONS:

Organise the 500 × 500 square canvas as follows:

TOP AREA (SAFE ZONE):
- Reserve upper one-third for text overlay
- Keep this area visually clean and uncluttered (solid color field, subtle texture, or soft gradient)
- Do not place faces or main subjects in the upper one-third

CENTRAL & LOWER AREA (ARTWORK ZONE):
- Illustrated artwork occupies the central two-thirds of the image
- Make artwork substantial, detailed, original, and directly relevant to the article

BOTTOM AREA (SAFE ZONE):
- Reserve lower 15% for footer text overlay

FINAL SIZE INSTRUCTION:
Generate exactly one Facebook square graphic background with a final canvas of 500 pixels wide × 500 pixels high.`,
  negativePrompt:
    'written text, readable letters, words, numbers, headlines, captions, logos, labels, signs, typographic marks, garbled text, pseudo-letters, square font boxes, missing glyph boxes, question mark boxes, [?][?][?], real human photograph, photorealistic person, photographic face, stock-photo model, celebrity likeness, influencer portrait, selfie, realistic lifestyle photography, glamour photography, fake doctor, fake therapist, photographic couple, photographic family, hyperrealistic skin, glossy synthetic skin, generic AI face, plastic-looking illustrated character, inconsistent anatomy, malformed hands, extra fingers, duplicated facial features, artificial symmetry, generic AI fantasy art, excessive glow, meaningless surreal objects, random background details, oversaturated neon colours, repetitive character template, hashtags, Facebook label, platform name, reaction icons, comment icon, share icon, fake social-media button, fake app interface, fake logo, generated logo, misspelled logo, watermark, signature, wrong dimensions, portrait image, landscape image, 2:3 ratio, 4:5 ratio, 9:16 ratio, rectangular canvas, borders, mockup frame, phone screen, blank padding, tiny artwork, artwork occupying less than half the image, excessive empty space, overcrowded composition, irrelevant visual, childish clip art, cheap cartoon template, generic motivational poster, copied reference-image layout, copyrighted character, third-party logo, recognisable copyrighted artwork, branded product, graphic violence, blood, wounds, weapons, self-harm imagery, suicide-related imagery or symbols, pills, needles, syringes, weighing scales, measuring tapes, before-and-after body imagery, body shaming, smoking, drug use, sexualised imagery',
  styleNotes:
    'Create a bold, premium, illustrated Facebook editorial graphic for The Minds Journal.\n\nMandatory visual balance:\n\n- Approximately one-third title and typography\n- Approximately two-thirds relevant illustrated artwork\n- One separate curiosity-driven footer\n- One short, adaptive comments CTA\n- Small official logo in a safe corner\n\nUse illustrations, illustrated characters, conceptual artwork, magazine collage, paper textures, painted imagery, retro editorial art, pop-art treatment, surreal symbolism, stylised science illustration, or mixed-media editorial composition.\n\nNever use real human photography.',
} as const;
