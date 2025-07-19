/**
 * Updates colors in a Lottie animation JSON data for mascot icon
 * @param {Object} animationData - The original Lottie animation JSON
 * @param {String} mode - animation theme mode
 * @returns {Object} - Modified animation data with new colors
 */
export function updateMascatWalkingAnimation(obj, mode) {
  if (typeof obj !== 'object' || obj === null) return obj;

  // Create a shallow copy if it's an array or object
  const newObj = Array.isArray(obj) ? [...obj] : {...obj};

  for (const key in newObj) {
    if (
      key === 'c' &&
      newObj[key] &&
      typeof newObj[key] === 'object' &&
      newObj[key].a === 0 &&
      Array.isArray(newObj[key].k)
    ) {
      // Create a new object for this property with the updated k array
      newObj[key] = {
        ...newObj[key],
        k: mode === 'blue' ? [0.0118, 0.4588, 0.9647] : [1, 1, 1],
      };
    } else if (typeof newObj[key] === 'object') {
      // Recurse through nested objects/arrays
      newObj[key] = updateMascatWalkingAnimation(newObj[key], mode);
    }
  }

  return newObj;
}

/**
 * Updates colors in a Lottie animation JSON data for blitz splashscreen
 * @param {Object} animationData - The original Lottie animation JSON
 * @param {Object} colorSettings - Object containing color overrides
 * @returns {Object} - Modified animation data with new colors
 */
export function updateBlitzAnimationData(animationData, colorSettings) {
  // Make a deep copy of the animation data to avoid modifying the original
  const modifiedData = JSON.parse(JSON.stringify(animationData));

  // Default color settings if none provided
  const defaults = {
    rectangleFill: [0, 0.1451, 0.3059], // Dark blue-gray
    shapeFill: [0.011765, 0.458824, 0.964706, 1], // Same blue as before
  };

  // Merge provided settings with defaults
  const colors = {...defaults, ...colorSettings};

  // Process each layer
  modifiedData.layers.forEach(layer => {
    if (layer.shapes) {
      layer.shapes.forEach(shapeGroup => {
        if (shapeGroup.it) {
          shapeGroup.it.forEach(item => {
            if (item.ty === 'gr') {
              item.it.forEach(element => {
                if (element.ty === 'fl' && element.c && element.c.k) {
                  if (element.c.k.length === 3) {
                    // This is the rectangle fill (RGB)
                    element.c.k = colors.rectangleFill;
                  } else if (element.c.k.length === 4) {
                    // This is the shape fill (RGBA)
                    element.c.k = colors.shapeFill;
                  }
                }
              });

              // Update rectangle fill color
            }
          });
        }

        // Also check for direct fill items (not in groups)
        if (shapeGroup.ty === 'fl' && shapeGroup.c && shapeGroup.c.k) {
          if (shapeGroup.c.k.length === 4) {
            shapeGroup.c.k = colors.shapeFill;
          }
        }
      });
    }
  });

  return modifiedData;
}

/**
 * Updates colors in a Lottie animation JSON data for different themes
 * @param {Object} animationData - The original Lottie animation JSON
 * @param {string} theme - Theme to apply ('dark', 'lightsOut', or default)
 * @returns {Object} - Modified animation data with theme colors
 */
export function updateConfirmAnimation(animationData, theme = 'dark') {
  // Make a deep copy of the animation data to avoid modifying the original
  const modifiedData = JSON.parse(JSON.stringify(animationData));

  // Color configurations for different themes
  const themeColors = {
    light: {
      strokeColor: [248 / 255, 248 / 255, 248 / 255],
      fillColor: [0, 0.4706, 1, 1],
      assetStrokeColor: [0, 0.4706, 1, 1],
    },
    dark: {
      strokeColor: [0, 0.1451, 0.3059],
      fillColor: [1, 1, 1],
      assetStrokeColor: [1, 1, 1],
    },
    lightsOut: {
      strokeColor: [0, 0, 0],
      fillColor: [1, 1, 1],
      assetStrokeColor: [1, 1, 1],
    },
  };

  // Get the color settings for the selected theme
  const colors = themeColors[theme] || themeColors.dark;

  // Process main layers
  modifiedData.layers.forEach(layer => {
    if (layer.shapes) {
      processShapes(layer.shapes, colors);
    }
  });

  // Process assets
  if (modifiedData.assets) {
    modifiedData.assets.forEach(asset => {
      if (asset.layers) {
        asset.layers.forEach(layer => {
          if (layer.shapes) {
            processShapes(layer.shapes, colors, true);
          }
        });
      }
    });
  }

  return modifiedData;
}

// Helper function to process shapes recursively
function processShapes(shapes, colors, isAsset = false) {
  shapes.forEach(shape => {
    // Process groups
    if (shape.ty === 'gr' && shape.it) {
      processShapes(shape.it, colors, isAsset);
    }

    // Process strokes
    if (shape.ty === 'st' && shape.c && shape.c.k) {
      // Use asset stroke color for assets, otherwise use theme stroke color
      shape.c.k = isAsset ? colors.assetStrokeColor : colors.strokeColor;
    }

    // Process fills (but don't override asset fills)
    if (shape.ty === 'fl' && shape.c && shape.c.k && !isAsset) {
      shape.c.k = colors.fillColor;
    }
  });
}

/**
 * Applies a theme to a Lottie animation JSON
 * @param {Object} animationData - Original Lottie animation JSON
 * @param {string} theme - Theme to apply ('default', 'dark', or 'lightsOut')
 * @returns {Object} - Modified animation data with theme colors
 */
export function applyErrorAnimationTheme(animationData, theme = 'light') {
  // Make a deep copy of the animation data
  const modifiedData = JSON.parse(JSON.stringify(animationData));

  // Define color schemes for each theme
  const colorSchemes = {
    light: {
      pointFill: [1, 1, 1, 1],
      pointStroke: [1, 1, 1, 1],
      exFill: [0.898, 0.18, 0.18, 1],
      exStroke: [1, 1, 1, 1],
      mainFill: [0.898, 0.18, 0.18, 1],
      mainStroke: [1, 1, 1, 1],
      rayFill: [0.898, 0.18, 0.18, 1],
      rayStroke: [0.898, 0.18, 0.18, 1],
    },
    dark: {
      pointFill: [0, 0.145, 0.306, 1],
      pointStroke: [0, 0.145, 0.306, 1],
      exFill: [0, 0.145, 0.306, 1],
      exStroke: [0, 0.145, 0.306, 1],
      mainFill: [1, 1, 1, 1],
      mainStroke: [1, 1, 1, 1],
      rayFill: [1, 1, 1, 1],
      rayStroke: [1, 1, 1, 1],
    },
    lightsOut: {
      pointFill: [0, 0, 0, 1],
      pointStroke: [0, 0, 0, 1],
      exFill: [0, 0, 0, 1],
      exStroke: [0, 0, 0, 1],
      mainFill: [1, 1, 1, 1],
      mainStroke: [1, 1, 1, 1],
      rayFill: [1, 1, 1, 1],
      rayStroke: [1, 1, 1, 1],
    },
  };

  // Get the selected color scheme
  const colors = colorSchemes[theme] || colorSchemes.default;

  // Process each layer
  modifiedData.layers.forEach(layer => {
    if (!layer.shapes) return;

    // POINT layer
    if (layer.nm === 'POINT') {
      processShapesForError(layer.shapes, colors.pointFill, colors.pointStroke);
    }
    // Ex layer
    else if (layer.nm === 'Ex') {
      processShapesForError(layer.shapes, colors.exFill, colors.exStroke);
    }
    // MAIN 3 layer
    else if (layer.nm === 'MAIN 3') {
      processShapesForError(layer.shapes, colors.mainFill, colors.mainStroke);
    }
    // RAY 2 layer
    else if (layer.nm === 'RAY 2') {
      processShapesForError(layer.shapes, colors.rayFill, colors.rayStroke);
    }
  });

  return modifiedData;
}

// Helper function to process shapes and apply colors
function processShapesForError(shapes, fillColor, strokeColor) {
  shapes.forEach(shape => {
    // Process groups recursively
    if (shape.ty === 'gr' && shape.it) {
      processShapesForError(shape.it, fillColor, strokeColor);
    }

    // Process fills
    if (shape.ty === 'fl' && shape.c) {
      shape.c.k = fillColor;
    }

    // Process strokes
    if (shape.ty === 'st' && shape.c) {
      shape.c.k = strokeColor;
    }
  });
}
