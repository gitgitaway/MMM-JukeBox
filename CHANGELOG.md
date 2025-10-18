# Changelog

All notable changes to MMM-JukeBox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2025-09-30

### Added
- **Volume Control System**
  - UI volume slider with configurable visibility (`showVolumeControl`)
  - Persistent volume storage (localStorage + backend `settings.json`)
  - Debounced volume input handling (`volumeInputDebounceMs`) to reduce rapid updates
  - Volume synchronization between frontend and backend
  - Default volume configuration (`defaultVolume` 0-100%)
  - Volume label customization (`volumeLabel`)

- **Control Bar Interface**
  - New symbol-based control bar option (`showControlBar`)
  - Icon buttons: Previous (◀), Pause/Resume (⏸), Play (▷), Stop (✖), Next (▶)
  - Active state highlighting for control bar buttons
  - Smooth transitions and hover effects
  - Maintains backward compatibility with legacy button layout

- **Playback State Persistence**
  - localStorage-based state restoration across page reloads
  - Persists: active track index, random mode status, stopped state
  - Automatic state recovery on module start

- **USB Source Enhancements**
  - USB path probing with automatic retry mechanism (`usbProbeRetryMs`)
  - USB to local sync functionality (`syncUsbToLocal`)
  - Sync status display with spinner animation
  - Backup functionality for local files before USB sync (`backupLocal`)
  - Detailed sync results (files copied, skipped, destination)
  - Fade-out status messages for completed operations

- **Security Features**
  - USB streaming path restriction (`restrictUsbBase`)
  - Configurable allowed USB base path (`allowedUsbBase`)
  - Path traversal prevention in Express route
  - File extension validation for streaming
  - HTTP range request support for audio streaming

- **UI/UX Improvements**
  - Throttled DOM updates (`updateDomThrottleMs`) for performance
  - Marquee scrolling for long "Now Playing" text (`marqueeNowPlaying`)
  - Info icon tooltips for status messages
  - Fade-out animations for ephemeral status (10s)
  - Spinner animation during sync operations
  - Focus-visible styles for accessibility
  - Active button transform feedback (scale on click)
  - **Hide/Show Toggle** (`showHideToggle`) - On-screen toggle button to collapse/expand the module grid while keeping playback and controls functional. Provides a compact collapsed view with control bar and now-playing info only

- **Configuration Options**
  - `showPauseButton` - Toggle pause/resume button visibility
  - `showStopButton` - Toggle stop button visibility
  - `showSyncStatus` - Display sync/probe status messages
  - `rescanIntervalMs` - Optional periodic track rescanning
  - `volumeInputDebounceMs` - Volume slider debounce timing
  - `updateDomThrottleMs` - DOM update throttle interval
  - `usbProbeRetryMs` - USB path probe retry interval
  - `restrictUsbBase` - Enable USB path security restrictions
  - `allowedUsbBase` - Explicit allowed USB base path
  - `backupLocal` - Backup local files before USB operations
  - `showHideToggle` - Enable on-screen hide/show toggle button for collapsing the module grid

- **Theme Customization**
  - `darkMode` - Force dark/light mode or auto-detect
  - `fontColorOverride` - Override all font colors
  - `opacityOverride` - Override all opacity values
  - `borderColorOverride` - Override inactive button border colors
  - Dynamic CSS injection for theme overrides

- **Developer Features**
  - Debug logging system with file output (`.logs/debugLog.txt`)
  - `SET_DEBUG` notification for enabling backend logging
  - `DEBUG_LOG` notification for custom log entries
  - Comprehensive error handling with try-catch blocks
  - Detailed console logging for troubleshooting

### Changed
- **Backend Architecture**
  - Refactored to use async/await for file operations
  - Improved error handling throughout node_helper
  - Enhanced Express route with range request support
  - Settings persistence via JSON file (`settings.json`)

- **Audio Playback**
  - Single reusable Audio element (prevents memory leaks)
  - Volume applied to all playback modes (single, random, sequential)
  - Improved track transition handling
  - Better error recovery on playback failures

- **File Scanning**
  - Enhanced title normalization (removes numeric prefixes, underscores)
  - Natural numeric sorting for track lists
  - Case-insensitive extension filtering
  - Improved directory validation

- **UI Rendering**
  - Optimized DOM updates with throttling
  - Reduced unnecessary re-renders
  - Better loading state management
  - Improved pagination controls

### Fixed
- Memory leaks from multiple Audio element creation
- Volume not persisting across page reloads
- Race conditions in USB sync operations
- Path traversal vulnerabilities in USB streaming
- Inconsistent button states during playback
- DOM update performance issues with large track lists
- Missing error handling in async operations

---

## [1.0.0] - Initial Release

### Added
- **Core Functionality**
  - Audio playback from local files, USB drives, or URLs
  - Numbered button grid for track selection
  - Random play mode with continuous looping
  - Stop functionality
  - Auto-scan of audio files from configured directories

- **Source Options**
  - Local file support (`source: "file"`)
  - USB drive support with secure streaming (`source: "USB"`)
  - URL-based track support (`source: "URL"`)
  - Configurable USB path (`usbPath`)

- **UI Features**
  - Responsive button grid layout
  - Pagination for large track libraries (`pageSize`)
  - "Now Playing" display with title and artist
  - Track duration display
  - Hover and active button states
  - Info text customization

- **Configuration**
  - Customizable button labels (`randomButtonText`, `stopButtonText`)
  - Allowed file extensions filter (`allowedExtensions`)
  - Continue playback on module hide (`continueOnHide`)
  - Autostart random loop option (`autostartRandomLoop`)
  - Custom info text (`infoText`)

- **Color Scheme**
  - Configurable active button color (`colorActive`)
  - Configurable hover color (`colorHover`)
  - Configurable default button color (`colorDefault`)
  - Celtic FC themed defaults (green #018749, gold #FFD700)

- **Backend Features**
  - Non-recursive directory scanning
  - Express route for secure USB file streaming
  - File extension filtering
  - Title normalization from filenames
  - Socket notification system

- **File Support**
  - MP3 audio files
  - WAV audio files
  - OGG audio files
  - M4A audio files

- **Styling**
  - Modern rounded button design
  - Smooth transitions and animations
  - Responsive layout
  - Dark theme optimized
  - Custom CSS classes for theming

### Technical Details
- MagicMirror² module architecture
- Node.js backend with Express
- Socket.io for frontend-backend communication
- HTML5 Audio API for playback
- CSS3 animations and transitions

---

## Future Enhancements

### Planned Features
- Shuffle history to avoid recent repeats
- Bluetooth speaker option for auto discovery,pairing and streamimg
- Playlist support with JSON configuration


### Under Consideration
- Streaming service integration (Spotify, etc.)
- Voice control integration
- RFID integration for physical track selection
- Recursive directory scanning option
- Album art display
- Track search/filter functionality
- Keyboard shortcuts for playback control
- Multi-language support
---

## Notes

### Version Numbering
- **Major version** (X.0.0): Breaking changes or major feature overhauls
- **Minor version** (1.X.0): New features, backward compatible
- **Patch version** (1.0.X): Bug fixes, minor improvements

### Compatibility
- Tested with MagicMirror² current versions
- Requires Node.js with Express support
- Browser must support HTML5 Audio API
- USB streaming requires filesystem access

### Credits
- **Author**: gitgitaway
- **AI Assistant**: Zencoder AI
- **Inspiration**: MMM-MusicPlayer by @jasonacox
- **Community**: MagicMirror² community

### License
MIT License - See LICENSE file for details

---

## Links
- **Repository**: https://github.com/gitgitaway/MMM-JukeBox
- **Issues**: https://github.com/gitgitaway/MMM-JukeBox/issues
- **MagicMirror²**: https://magicmirror.builders/

---

*This changelog is maintained to help users understand changes between versions and assist with upgrades.*