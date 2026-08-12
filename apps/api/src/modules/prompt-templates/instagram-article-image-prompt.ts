export const instagramArticleImagePrompt = {
  name: 'Instagram illustrated clickable square article image',
  description:
    'A 500 × 500 Instagram graphic with a bold clickable title, relevant illustrated artwork, curiosity-driven footer, and an adaptive link-in-bio CTA.',
  template: `Create exactly one complete, post-ready Instagram square article visual background for The Minds Journal.

MANDATORY OUTPUT FORMAT:

- Final canvas: exactly 500 pixels wide × 500 pixels high
- Aspect ratio: exactly 1:1 square
- Generate only one image
- Do not generate a portrait, landscape, 2:3, 4:5, 9:16, Story, or Reel format
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

Turn the supplied article into a visually compelling Instagram editorial illustration that represents the central theme.

Do not use real human photography. Use illustrations, illustrated characters, editorial artwork, conceptual artwork, collage, painted artwork, or stylised visual storytelling.

MANDATORY VISUAL PROPORTIONS:

Organise the 500 × 500 square canvas as follows:

TOP AREA (SAFE ZONE):
- Reserve approximately the upper one-third for text overlay
- Keep this area visually clean and uncluttered (solid color field, subtle texture, or soft gradient)
- Do not place faces, detailed subjects, or main visual objects in the upper one-third

CENTRAL & LOWER AREA (ARTWORK ZONE):
- The illustrated artwork must occupy the central two-thirds of the image
- Make the artwork substantial, original, polished, and directly relevant to the article
- Communicate the article’s central emotional, psychological, practical, or symbolic idea

BOTTOM AREA (SAFE ZONE):
- Reserve the lower 15% for footer text overlay
- Keep this area simple and uncluttered

FINAL SIZE INSTRUCTION:
Generate exactly one Instagram square graphic background with a final canvas of 500 pixels wide × 500 pixels high. Preserve the exact 1:1 square format.`,
  negativePrompt:
    'written text, readable letters, words, numbers, headlines, captions, logos, labels, signs, typographic marks, garbled text, pseudo-letters, square font boxes, missing glyph boxes, question mark boxes, [?][?][?], real human photograph, photorealistic person, photographic face, stock-photo model, celebrity likeness, influencer portrait, selfie, realistic lifestyle photography, glamour photography, fake doctor, fake therapist, photographic couple, photographic family, hyperrealistic skin, glossy synthetic skin, generic AI face, plastic-looking illustrated character, inconsistent anatomy, malformed hands, extra fingers, duplicated facial features, artificial symmetry, generic AI fantasy art, excessive glow, meaningless surreal objects, random background details, oversaturated neon colours, repetitive character template, hashtags, Instagram label, platform name, like icon, comment icon, share icon, save icon, fake social-media button, fake app interface, fake logo, generated logo, misspelled logo, watermark, signature, wrong dimensions, portrait image, landscape image, Story format, Reel format, 2:3 ratio, 4:5 ratio, 9:16 ratio, rectangular canvas, borders, mockup frame, phone screen, blank padding, tiny artwork, artwork occupying less than half the image, excessive empty space, overcrowded composition, irrelevant visual, childish clip art, cheap cartoon template, generic motivational poster, copied reference-image layout, copyrighted character, third-party logo, recognisable copyrighted artwork, branded product, graphic violence, blood, wounds, weapons, self-harm imagery, suicide-related imagery or symbols, pills, needles, syringes, weighing scales, measuring tapes, before-and-after body imagery, body shaming, smoking, drug use, sexualised imagery',
  styleNotes:
    'Create a bold, premium, illustrated Instagram editorial graphic for The Minds Journal.\n\nMandatory visual balance:\n\n- Approximately one-third title and typography\n- Approximately two-thirds relevant illustrated artwork\n- One separate curiosity-driven footer\n- One short, adaptive link-in-bio CTA\n- Small official logo in a safe corner\n\nUse illustrations, illustrated characters, conceptual artwork, magazine collage, paper textures, painted imagery, retro editorial art, pop-art treatment, surreal symbolism, stylised science illustration, or mixed-media editorial composition.\n\nNever use real human photography.',
} as const;
