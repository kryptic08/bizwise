# App Icon Setup Instructions

Your app is now configured and ready to build! However, you need to create the app icon images from the LogoBizwise.svg file.

## Required Icon Files

You need to create the following PNG images from your LogoBizwise.svg:

### 1. Main App Icon

- **File**: `assets/images/icon.png`
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparency
- **Background**: Transparent or white

### 2. Android Adaptive Icon - Foreground

- **File**: `assets/images/android-icon-foreground.png`
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparency
- **Content**: Just the graph/chart part of your logo (centered, with transparent background)
- **Safe area**: Keep the important parts within a 432x432 pixel circle in the center

### 3. Android Adaptive Icon - Background (Optional)

- **File**: `assets/images/android-icon-background.png`
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **Content**: Solid color (#3b6ea5 - your primary blue) or a subtle pattern
- **Note**: Can be a simple solid color background

### 4. Android Adaptive Icon - Monochrome

- **File**: `assets/images/android-icon-monochrome.png`
- **Size**: 1024x1024 pixels
- **Format**: PNG with transparency
- **Content**: Single-color (white) version of your logo for themed icons
- **Background**: Transparent

### 5. Splash Screen Icon

- **File**: `assets/images/splash-icon.png`
- **Size**: 1024x1024 pixels (or larger)
- **Format**: PNG
- **Content**: Your logo for the splash screen
- **Background**: Can match your primary color (#3b6ea5)

## How to Create Icons

### Option 1: Using Online Converters (Easiest)

1. Go to https://svg2png.com/ or https://cloudconvert.com/svg-to-png
2. Upload your `LogoBizwise.svg`
3. Set size to 1024x1024
4. Download and save to the appropriate location

### Option 2: Using Figma/Adobe Illustrator (Best Quality)

1. Import LogoBizwise.svg
2. Create artboards with sizes listed above
3. Export each artboard as PNG with the correct settings

### Option 3: Using Inkscape (Free)

1. Open LogoBizwise.svg in Inkscape
2. File → Export PNG Image
3. Set width and height to 1024 pixels
4. Export to the correct file path

## Important Notes

- **Transparency**: Make sure icon.png and android-icon-foreground.png have transparent backgrounds
- **Safe Area**: For Android adaptive icons, keep important content centered (within a 432px diameter circle)
- **File Names**: Must match exactly as listed above
- **Location**: All files should be in `assets/images/` directory

## Verification

After creating the icons, you can test them:

```bash
npx expo start
```

Then:

- Press `a` for Android
- Press `i` for iOS

The app should show your custom icon!

## App Configuration Summary

Your app.json is now configured with:

- **App Name**: "BizWise - Expense Manager"
- **Bundle ID (iOS)**: com.bizwise.expensemanager
- **Package Name (Android)**: com.bizwise.expensemanager
- **Primary Color**: #3b6ea5 (Professional Blue)
- **Version**: 1.0.0

Ready to build your app once icons are created! 🚀
