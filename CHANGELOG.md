# Changelog

All notable changes to the MMM-JukeBox module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2025-09-22

### Added
- **Control Bar Mode**: New `showControlBar` option to display modern symbol-based controls (◀ ⏸ ▷ ✖ ▶) instead of traditional text buttons
  - Previous track, pause/resume, play, stop, and next track controls
  - Active state highlighting with color-coded visual feedback (gold borders, colored icons)
  - Hover effects and tactile feedback on button press
- **Volume Control**: Persistent volume slider with real-time adjustment
  - `showVolumeControl` option to toggle visibility
  - `defaultVolume` setting (0-100) for initial volume
  - `volumeInputDebounceMs` for performance optimization during slider adjustment
  - Volume state persisted both client-side (localStorage) and server-side (settings.json)
  - Synchronized volume across module reloads and MagicMirror restarts
- **Playback State Persistence**: Module remembers playback state across sessions
  - Active track index, random mode status, and stopped state saved to localStorage
  - Automatic state restoration on module reload
- **USB Path Probing**: Automatic detection and retry mechanism for USB drives
  - `usbProbeRetryMs` option for periodic retry attempts when USB path is unavailable
  - Real-time status feedback in UI when USB path is inaccessible
- **Backup Functionality**: Optional backup of local soundFiles before USB sync
  - `backupLocal` option to copy ./soundFiles to ./backupFiles
  - One-time backup before first USB scan/sync operation
  - Status display showing copied/skipped file counts
- **Enhanced Security**: Configurable USB streaming restrictions
  - `restrictUsbBase` option to limit streaming to configured base path only
  - `allowedUsbBase` explicit path allowance for additional security
  - Path traversal prevention in Express route handler
  - Extension whitelist enforcement (blocks non-audio files)
- **Sync Status Display**: Visual feedback for USB-to-local synchronization
  - `showSyncStatus` option to display sync progress and results
  - Animated spinner during active sync operations
  - Detailed sync results (files copied/skipped) with fade-out animation
  - Info icons with hover tooltips for additional details
- **Theme Customization**: Advanced appearance override options
  - `darkMode` setting (null=auto, true=force dark, false=force light)
  - `fontColorOverride` to set custom font colors globally
  - `opacityOverride` to adjust transparency levels
  - `borderColorOverride` to customize inactive button border colors
  - Dynamic CSS injection for runtime theme application
- **Performance Optimizations**:
  - `updateDomThrottleMs` option to throttle DOM updates and reduce rendering overhead
  - Debounced volume input handling to minimize rapid update events
  - Throttled updateDom helper function for improved performance
- **Periodic Rescan**: Optional automatic track list refresh
  - `rescanIntervalMs` option for periodic directory scanning (0=disabled)
  - Useful for detecting newly added files without manual refresh
- **Debug Logging**: Backend debug system for troubleshooting
  - `debug` config option to enable detailed logging
  - Debug output written to `.logs/debugLog.txt`
  - Socket notification for runtime debug line appending
- **Accessibility Improvements**:
  - Focus-visible styles for keyboard navigation (gold outline on focus)
  - ARIA labels for icon buttons (e.g., spinner with "Syncing" label)
  - Improved contrast ratios for better readability
- **Enhanced Button Styling**:
  - Larger touch targets (38x38px) for improved mobile usability
  - Active state transform feedback (scale on press)
  - Smooth transitions for all interactive elements
  - Color-coded active states for control bar icons

### Changed
- **Module Version**: Updated from 1.0.0 to 1.1.0
- **Button Grid Styling**: Improved default opacity (0.9) for better contrast and visibility
- **Now Playing Display**: Enhanced marquee scrolling with configurable `marqueeNowPlaying` option
- **Control Layout**: Reorganized controls into unified row for better space efficiency
- **Volume Management**: Centralized volume handling with dual persistence (client + server)
- **USB Streaming**: Enhanced Express route with range request support for better audio seeking
  - Proper Content-Range headers for partial content (HTTP 206)
  - Improved error handling and logging for stream failures
  - Content-Type detection based on file extension
- **Sync Logic**: Improved USB-to-local sync with size and timestamp comparison
  - Skip files that already exist with matching size and newer modification time
  - Reduced unnecessary file copying for better performance
- **Error Handling**: Comprehensive try-catch blocks throughout codebase
  - Graceful fallbacks for failed operations
  - Detailed error messages in console and UI
- **Code Documentation**: Extensive inline comments explaining functionality and design decisions

### Fixed
- **USB File Playback**: Resolved browser `file:///` restrictions by streaming via Express route
- **State Synchronization**: Fixed volume desync between frontend and backend
- **Pagination**: Corrected page calculation for large track libraries
- **Random Mode**: Ensured proper shuffle behavior and loop continuation
- **Module Lifecycle**: Proper cleanup of intervals on suspend/stop to prevent memory leaks
- **Path Resolution**: Normalized path handling for cross-platform compatibility (Windows/Linux)

### Security
- **Path Traversal Protection**: Strict validation in USB streaming route to prevent directory escape
- **Extension Whitelist**: Backend enforcement of allowed audio file extensions
- **Base Path Restriction**: Configurable USB base path limitation to prevent unauthorized file access
- **Input Validation**: Sanitization of user-provided paths and parameters

---

## [1.0.0] - 2025-09-19

### Added
- **Initial Release**: First public version of MMM-JukeBox
- **Multi-Source Support**: Play audio from local files, USB drives, or URLs
  - `source` option: "file", "USB", or "URL"
  - Automatic file scanning for local and USB sources
  - Manual track list for URL sources
- **Numbered Button Grid**: Dynamic grid of numbered buttons matching track count
  - Configurable `pageSize` for pagination (default: 40 buttons per page)
  - Hover effects and active state highlighting
  - Responsive layout with flexbox
- **Random Play Mode**: Continuous randomized playback loop
  - Shuffle algorithm for non-repeating track order
  - `autostartRandomLoop` option for automatic startup
  - Visual indicator for active random mode
- **Playback Controls**: Traditional button-based controls
  - Random Play button with active state
  - Stop button to halt playback
  - Pause/Resume button (optional via `showPauseButton`)
  - Individual track selection via numbered buttons
- **USB File Sync**: Optional synchronization from USB to local storage
  - `syncUsbToLocal` option to copy files from USB to ./soundFiles
  - Enables persistent playback without USB drive connected
  - Smart sync: only copies new or modified files
- **Now Playing Display**: Real-time track information
  - Track title and artist display
  - Duration display (once metadata loads)
  - Optional marquee scrolling for long titles
- **Pagination**: Navigate large track libraries
  - Previous/Next page buttons
  - Current page indicator (e.g., "Page 1 of 3")
  - Disabled state for unavailable navigation
- **File Scanning**: Automatic audio file detection
  - `allowedExtensions` filter: .mp3, .wav, .ogg, .m4a (configurable)
  - Non-recursive directory scanning for performance
  - Natural numeric sorting (e.g., "01 - Song" before "02 - Song")
  - Automatic title formatting (removes numeric prefixes, replaces underscores)
- **Express Route**: Secure USB file streaming endpoint
  - `/MMM-JukeBox/usb` route with base and file parameters
  - URL-encoded path handling
  - Basic Content-Type detection
- **Customizable Labels**: Configurable button text
  - `randomButtonText` (default: "Random Play")
  - `stopButtonText` (default: "Stop")
  - `infoText` (default: "Select a number or use Random Play.")
  - `volumeLabel` (default: "Volume")
- **Continue on Hide**: Optional audio continuation when module is hidden
  - `continueOnHide` option (default: true)
  - Allows background playback during module visibility changes
- **Celtic Theme**: Default green and gold color scheme
  - Celtic FC inspired colors (#018749 green, #FFD700 gold)
  - Configurable via `colorActive`, `colorHover`, `colorDefault` options
  - Dark background with high contrast text
- **Responsive Design**: Mobile-friendly layout
  - Touch-optimized button sizes
  - Flexible grid wrapping
  - Centered alignment with max-width constraint

### Technical Details
- **Frontend**: MMM-JukeBox.js (Module.register implementation)
  - HTML5 Audio API for playback
  - LocalStorage for client-side state persistence
  - Socket.io for backend communication
- **Backend**: node_helper.js (NodeHelper implementation)
  - Express.js route for USB streaming
  - File system operations (fs/fsp) for scanning and syncing
  - JSON settings file for server-side persistence
- **Styling**: MMM-JukeBox.css
  - Flexbox-based responsive grid
  - CSS transitions and animations
  - Custom range slider styling (WebKit and Firefox)
  - Keyframe animations for marquee and spinner effects

### Dependencies
- **Runtime**: Node.js, MagicMirror² framework
- **Development**: 
  - eslint ^8.57.0 (code linting)
  - prettier ^3.2.5 (code formatting)
  - debug ^4.3.4 (debugging utilities)
  - nodemon ^3.0.2 (development server)

### Documentation
- Comprehensive README.md with:
  - Installation instructions
  - Configuration examples
  - Feature descriptions
  - Troubleshooting tips
  - Socket notification reference
  - Styling customization guide
- Screenshots demonstrating:
  - Traditional button layout
  - Control bar layout
  - Full Celtic-themed MagicMirror setup
- MIT License
- GitHub repository: https://github.com/gitgitaway/MMM-JukeBox.git

### Credits
- **Author**: gitgitaway
- **Inspiration**: MMM-MusicPlayer by @jasonacox
- **Part of Celtic MagicMirror Suite**:
  - Module 1: MMM-MyTeams-Clock
  - Module 2: MMM-MyTeams-LeagueTable
  - Module 3: MMM-MyTeams-Fixtures
  - Module 4: MMM-JukeBox (this module)
  - Module 5: MMM-Celtic-OnThisDay

---

## Release Notes

### Version 1.1.0 Highlights
This release focuses on **enhanced user experience** and **persistent state management**. The new control bar provides a modern, space-efficient interface, while volume persistence ensures your preferred audio level is maintained across sessions. USB path probing and sync status display improve reliability when working with external drives. Theme customization options allow seamless integration with any MagicMirror setup.

**Upgrade Path**: Existing configurations remain fully compatible. The traditional button layout is still the default (`showControlBar: false`). To use the new control bar, set `showControlBar: true` in your config.

### Version 1.0.0 Highlights
The initial release provides a **complete audio playback solution** for MagicMirror². Support for local files, USB drives, and URLs ensures flexibility for any setup. The numbered button grid makes track selection intuitive, while random play mode enables hands-free listening. USB sync functionality allows you to load tracks from a USB drive and play them locally without keeping the drive connected.

---

## Future Roadmap

### Planned Features
- **Playlist Management**: Create, save, and load custom playlists
- **Metadata Display**: Album art and extended track information
- **Voice Control**: Integration with voice assistant modules
- **Queue Management**: View and reorder upcoming tracks
- **Repeat Modes**: Single track repeat, playlist repeat options
- **Crossfade**: Smooth transitions between tracks
- **Sleep Timer**: Auto-stop after specified duration

### Known Issues
- **Browser Codec Support**: Some audio formats may not play in all browsers (convert to MP3 for best compatibility)
- **Large Libraries**: Very large track collections (>1000 files) may cause initial scan delays
- **USB Hotplug**: Module requires restart to detect newly connected USB drives (unless periodic rescan is enabled)
- **Marquee Timing**: Long track titles may require manual adjustment of animation duration

### Contributing
Contributions are welcome! Please submit issues and pull requests to the GitHub repository.

---

## License

MIT License - See LICENSE file for details

Copyright (c) 2025 gitgitaway