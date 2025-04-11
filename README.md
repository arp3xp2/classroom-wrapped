# Classroom Wrapped

A Google Apps Script application that provides teachers with a Spotify Wrapped-style overview of their students academic year in Google Classroom. Analyze submission patterns, material engagement, assignment trends, and more.

## Features

- **Submission Engagement**: Track total submissions, on-time vs. late ratio, submission patterns (by month, day, hour), completion rates, and student file uploads.
- **Material Analytics**: See statistics on material uploads and slide counts.
- **Assignment Insights**: Analyze assignment creation patterns (with vs. without deadlines) over time.
- **Submission Timing**: Identify "Early Bird" and "Night Owl" students based on their average submission times.


## Installation

### Deployment Instructions

1. Go to [Google Apps Script](https://script.google.com/) and create a new project
2. Copy all files from the `src` directory into your project:
   - `code.gs`, `data.gs`, `utilities.gs` (server-side code)
   - `Index.html`, `Scripts.html`, `Styles.html` (client-side code)
   - `appsscript.json` (project configuration)
3. Click on "Services" (+ icon) and add these Google services:
   - Google Classroom API
   - Google Drive API
   - Google Slides API
4. Save the project (Ctrl+S or ⌘+S)
5. Deploy as a web app:
   - Click "Deploy" > "New deployment"
   - Select "Web app" as the deployment type
   - Set "Execute as" to "User accessing the web app"
   - Set "Who has access" to "Anyone in your organization" or appropriate access level
   - Click "Deploy"
   - Authorize the app when prompted
   - Copy the provided URL to access your app

### Deployment with clasp

For developers familiar with [clasp](https://github.com/google/clasp) (Command Line Apps Script Projects), you can deploy using:

```bash
# Login to your Google account
clasp login

# Clone this repository
git clone https://github.com/arp3xp2/classroom-wrapped.git
cd classroom-wrapped

# Push code to Apps Script (will use src directory as specified in .clasp.json)
clasp push

# Create a new version
clasp version "Initial deployment"

# Deploy as a web app
clasp deploy --description "Classroom Wrapped Web App"
```

**Important Note:** The project uses the `webapp` configuration block in `appsscript.json` to ensure proper deployment as a Web App:

```json
// appsscript.json
{
  // ... other settings ...
  "webapp": {
    "access": "MYSELF", // Or USER_DOMAIN, ANYONE
    "executeAs": "USER_ACCESSING"
  }
}
```

## Required Permissions

When you first run the app, it will request the following permissions:

- **Google Classroom**: To access courses, topics, assignments, student submissions, and course materials.
- **Google Drive**: To analyze file metadata (size, type) for materials and student attachments.
- **Google Slides**: To count slides in presentation files.

The app runs under your account, so it only has access to the courses where you are a teacher or owner.

## Repository Structure

The repository is organized as follows:

```
/
├── src/               # All Apps Script code files
│   ├── code.gs
│   ├── data.gs
│   ├── utilities.gs
│   ├── appsscript.json
│   ├── Index.html
│   ├── Scripts.html
│   └── Styles.html
├── docs/              # Documentation
│   ├── PRD.md
│   ├── system-design.md
│   └── screenshots/
└── README.md          # This file
```

## Application Structure

The application is organized into server-side and client-side components:

### Server-Side Code
- `src/code.gs`: Entry points and core functionality
- `src/data.gs`: Data processing and analytics functions
- `src/utilities.gs`: Helper functions

### Client-Side Code
- `src/Index.html`: Main application interface
- `src/Styles.html`: CSS styling and themes
- `src/Scripts.html`: Client-side JavaScript and visualization logic

### Project Configuration
- `src/appsscript.json`: API and OAuth scope configuration

## Usage

1. Open the web app URL
2. Select a course from the dropdown
3. Choose the analysis period:
   - Entire course
   - Custom date range
4. Select optional features:
   - Count presentation slides (may take a few minutes for large courses)
5. Click "Generate Classroom Wrapped"
6. View the statistics and visualizations

## Performance Considerations

- For large courses with many assignments and submissions, the analysis may take several minutes
- The slide counting feature analyzes all Google Slide presentations in the course materials, which can significantly increase processing time
- Optimizations have been implemented to reduce API calls and improve performance
