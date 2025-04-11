# Classroom Wrapped

A Google Apps Script application that provides teachers with a Spotify Wrapped-style overview of their students academic year in Google Classroom. Analyze submission patterns, material engagement, assignment trends, and more.

## Features

- **Submission Analytics**: Track total submissions, on-time vs. late ratio, submission patterns (by month, day, hour), completion rates, and student file uploads (count, type, timeline).
- **Material Engagement**: See statistics on material uploads, file types, sizes, and detailed analysis of Google Slides presentations (slide count).
- **Assignment Insights**: Analyze assignment creation patterns (with vs. without deadlines) over time.
- **Submission Timing**: Identify "Early Bird" and "Night Owl" students based on their average submission times.


## Installation

### Deployment Instructions

1. Go to [Google Apps Script](https://script.google.com/) and create a new project
2. Copy all files from this repository into your project:
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
git clone https://github.com/yourusername/classroom-wrapped.git
cd classroom-wrapped

# Push code to Apps Script
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

## Application Structure

The application is organized into server-side and client-side components:

### Server-Side Code
- `code.gs`: Entry points and core functionality
- `data.gs`: Data processing and analytics functions
- `utilities.gs`: Helper functions

### Client-Side Code
- `Index.html`: Main application interface
- `Styles.html`: CSS styling and themes
- `Scripts.html`: Client-side JavaScript and visualization logic

### Project Configuration
- `appsscript.json`: API and OAuth scope configuration

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
7. Optionally export raw data as CSV

## Performance Considerations

- For large courses with many assignments and submissions, the analysis may take several minutes
- The slide counting feature analyzes all Google Slide presentations in the course materials, which can significantly increase processing time
- Optimizations have been implemented to reduce API calls and improve performance

## License

[MIT](https://choosealicense.com/licenses/mit/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.