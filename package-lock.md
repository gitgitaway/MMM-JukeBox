# MMM-JukeBox

A MagicMirror module for playing up to 50 local or remote audio tracks, with individual and random play modes.

## Features

- 50 numbered buttons for individual track play.
- "Random Play" button for continuous random looping.
- "Stop" button to end playback.
- Tracks can be local files (`soundFiles/`) or remote URLs.
- Playback continues even if the module is hidden (configurable).
- Retains color format, hover tooltips, and UI style from reference module.

## Installation

1. Copy all files to `MagicMirror/modules/MMM-JukeBox/`.
2. Place your 50 `.mp3` files in `MMM-JukeBox/soundFiles/` (named `01.mp3` to `50.mp3`).
3. Add the module to your `config.js`:

```javascript
{
  module: "MMM-JukeBox",
  position: "top_center",
  config: {
    // Optional: customize tracks, colors, etc.
  }
}
```

## Configuration

- `tracks`: Array of track objects `{ name, file, url }`.
- `continueOnHide`: If true, playback continues when module is hidden.
- See `MMM-JukeBox.js` for more options.

## License

MIT