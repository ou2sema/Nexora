// A 4x3 RGBA PNG and a 1x1 JPEG, both accepted by pdf-lib. They are built with
// Buffer.from, so their bytes sit inside Node's shared buffer pool at a non-zero offset:
// the shape pdf-lib's JPEG embedder misreads.
export const LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAFklEQVR4nGPQiNry/07Ulv8wmoGgAAD76R61DGuNpgAAAABJRU5ErkJggg==',
  'base64',
);

export const LOGO_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  'base64',
);
