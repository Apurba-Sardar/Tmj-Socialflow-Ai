export const pinterestArticleImagePrompt = {
  name: 'Pinterest illustrated clickable vertical article image',
  description:
    'A 500 × 750 Pinterest graphic with a bold clickable title, relevant illustrated artwork, curiosity-driven footer, and The Minds Journal logo.',
  template: `Create exactly one complete, post-ready Pinterest article visual background for The Minds Journal.

MANDATORY OUTPUT FORMAT:

- Final canvas: exactly 500 pixels wide × 750 pixels high
- Aspect ratio: exactly 2:3 vertical
- Orientation: portrait
- Generate only one image
- Do not generate a square or landscape image
- Do not add an outer border, frame, mockup, padding, or extended canvas
- The final exported file must remain exactly 500 × 750 pixels

CRITICAL TEXT AND LOGO RULE:
Do not render any written letters, words, numbers, titles, footers, captions, logos, signs, gibberish typography, or square font boxes directly on the image canvas. Generate pure illustrated background artwork with clean, uncluttered safe background areas at the top (upper 25%) and bottom (lower 15%). SocialFlow will add the approved headline, footer, and CTA text post-generation.

ARTICLE INFORMATION:

Article title: {{articleTitle}}
Article excerpt: {{articleExcerpt}}
Article categories: {{categories}}
Article context: {{articleContext}}
Topic safety guidance: {{topicGuidance}}

PRIMARY OBJECTIVE:

Turn the supplied article into a visually compelling vertical Pinterest editorial illustration that represents the central theme.

Do not use real human photography. Use illustrations, illustrated characters, editorial artwork, conceptual artwork, collage, painted artwork, or stylised visual storytelling.

MANDATORY VISUAL PROPORTIONS:

Organise the 500 × 750 vertical canvas as follows:

TOP AREA (SAFE ZONE):
- Reserve upper one-third for title text overlay
- Keep this area visually clean and uncluttered (solid color field, subtle texture, or soft gradient)
- Do not place faces or main visual subjects in the upper one-third

CENTRAL & LOWER AREA (ARTWORK ZONE):
- Illustrated artwork occupies the central two-thirds of the image
- Make artwork substantial, detailed, original, and directly relevant to the article

BOTTOM AREA (SAFE ZONE):
- Reserve lower 15% for footer text overlay

FINAL SIZE INSTRUCTION:
Generate exactly one Pinterest vertical graphic background with a final canvas of 500 pixels wide × 750 pixels high.`,
  negativePrompt:
    'written text, readable letters, words, numbers, headlines, captions, logos, labels, signs, typographic marks, garbled text, pseudo-letters, square font boxes, missing glyph boxes, question mark boxes, [?][?][?], real human photograph, photorealistic person, stock-photo person, celebrity likeness, influencer portrait, photographic face, hyperrealistic skin, glamour photography, selfie, lifestyle stock photography, repetitive AI woman, generic crying woman, lonely woman beside window, fake therapist, fake doctor, URL, hashtags, platform name, Pinterest label, social-media interface, fake buttons, app icons, fake logo, generated logo, misspelled logo, watermark, signature, wrong dimensions, square image, landscape image, 1:1 ratio, 4:5 ratio, 9:16 ratio, borders, mockup frame, blank padding, tiny artwork, excessive empty space, artwork occupying less than half of the image, cluttered composition, irrelevant visual, childish clip art, cheap cartoon template, generic motivational poster, copied reference-image composition, copyrighted character, third-party logo, recognisable copyrighted artwork, branded product, graphic violence, blood, wounds, weapons, self-harm imagery, suicide-related imagery or symbols, pills, needles, syringes, body-shaming imagery, weighing scales, measuring tapes, before-and-after body imagery, smoking, drug use, sexualised imagery',
  styleNotes:
    'Create a bold, premium, illustrated Pinterest editorial graphic for The Minds Journal.\n\nThe design should take inspiration from high-performing psychology and lifestyle editorial posters: strong headline hierarchy, visually meaningful illustrated artwork, expressive typography, conceptual storytelling, and a separate curiosity-driven footer.',
} as const;
