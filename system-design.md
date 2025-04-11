# System Design - Classroom Wrapped

## Architecture Overview

Classroom Wrapped is built as a Google Apps Script web application with a clear separation between:

1. **Server-side components** (Google Apps Script files):
   - `code.gs`: Core application logic and entry points
   - `data.gs`: Data analysis and processing functions
   - `utilities.gs`: Helper utilities and common functions

2. **Client-side components** (HTML templates):
   - `Index.html`: Main application interface and structure
   - `Styles.html`: CSS styling with theme support (dark/light mode)
   - `Scripts.html`: Client-side JavaScript for rendering and interactivity

3. **Configuration**:
   - `appsscript.json`: API services, OAuth scopes, and web app deployment settings

## Data Analysis Optimization (Refactoring)

### Goal
Improve the performance of the `franklinWrappedAnalysis` function by reducing redundant Google Classroom API calls.

### Previous State
The original implementation involved multiple analysis functions (`analyzeSubmissions`, `analyzeFeedbackDetailed`, etc.) each independently fetching necessary data (e.g., all coursework, all submissions for each assignment) via API calls. This led to significant redundancy, especially in loops fetching submissions for every assignment within multiple different analysis functions.

### Refactored Approach (`franklinWrappedAnalysis` in `data.gs`)

1.  **Centralized Data Fetching:**
    *   The main `franklinWrappedAnalysis` function now orchestrates the data retrieval.
    *   It fetches all required data *once* at the beginning:
        *   `getAllCourseWork(courseId)` -> `allCourseWork`
        *   `getAllMaterials(courseId)` -> `allMaterials`
        *   `getAllStudents(courseId)` -> `allStudents`
    *   It then iterates through `allCourseWork` *once*.
    *   Inside this loop, it filters coursework based on the optional `startDate` and `endDate`.
    *   For coursework *within* the date range (`relevantCourseWork`), it calls `getAllSubmissions(courseId, work.id)` to fetch submissions and stores them in a map (`allSubmissionsByWorkId`).

2.  **Passing Pre-Fetched Data:**
    *   The individual analysis functions (`analyzeSubmissions`, `analyzeMaterialsDetailed`, etc.) were modified.
    *   They no longer contain internal calls to `getAllCourseWork`, `getAllSubmissions`, etc.
    *   Instead, they now accept the relevant pre-fetched data structures (`relevantCourseWork`, `allSubmissionsByWorkId`, `allMaterials`, `allStudents`) as parameters.
    *   Date filtering logic was removed from these functions where applicable (as `relevantCourseWork` is already filtered), except where necessary (e.g., standalone materials in `analyzeMaterialsDetailed`).
    *   Each function now focuses solely on processing the provided data and returns its specific calculated statistics object.

### Benefits
*   **Reduced API Calls:** Significantly fewer calls to `Classroom.Courses.CourseWork.list`, `Classroom.Courses.CourseWork.StudentSubmissions.list`, etc., as data is fetched centrally rather than repeatedly within different analysis modules.
*   **Improved Performance:** Expected reduction in execution time, especially for courses with many assignments, materials, or students. The main bottleneck shifts to the initial, non-redundant data fetch.
*   **Cleaner Logic:** Individual analysis functions are simpler, focusing purely on calculation logic based on input data.

## Client-Side Architecture

### UI Components

The front-end is built with a modular approach:

1. **Main Container** (`Index.html`):
   * Course selection dropdown
   * Analysis configuration options
   * Time period selection (entire course or custom date range)
   * Toggle for slide counting
   * Theme switcher (dark/light mode)
   * Language selector (English/German)

2. **Results Display**:
   * Dynamic chart generation using Chart.js
   * Stats cards with animated counters
   * CSV data export functionality

3. **Progress Tracking**:
   * Visual progress bar
   * Cancellation capability
   * Log display for detailed operation tracking

### Themes & Internationalization

* **Theme System**:
  * CSS variables for consistent theming
  * Dark mode default with light mode option
  * Theme preference saved in localStorage

* **Language Support**:
  * Translation system covering English and German
  * Dynamic text replacement via data-lang-key attributes
  * Language preference saved in localStorage

### Chart Rendering

* **Dynamic Chart Creation**:
  * Charts are generated based on analysis results
  * Chart.js library loaded dynamically when needed
  * Theme-aware with colors responding to dark/light mode
  * Responsive sizing for different screen dimensions

## API Handling & Optimizations

### Findings: Comment Accessibility
*   **Private Grading Comments:** Extensive testing confirmed that private comments added by teachers via the Google Classroom grading interface are **not accessible** through the Classroom API (`submissions.list` or `submissions.get` methods, even with `fields=*`).
*   **Drive Comments:** The only accessible comments are those made directly on *attached Google Drive files*, which can be retrieved using the Google Drive API (`Drive.Comments.list`). The analysis now focuses solely on these.

### Drive API v3 Upgrade & File Access Compatibility

*   **Initial Problem:** Encountered frequent server errors (`5xx`) and subsequent "File not found" errors when accessing Google Drive files linked in Classroom materials, particularly when using Drive API v2.
*   **Upgrade to v3:** Upgraded from Drive API v2 to v3 for improved stability and performance.
*   **Classroom vs. Drive ID Mismatch:** Identified that file IDs provided by the Classroom API are not always directly compatible with the Drive API v3, leading to "File not found" errors.
*   **Shared Drive Support:** Added `supportsAllDrives: true` parameter to Drive API calls to ensure access to files located in Shared Drives.
*   **Tiered Access Strategy:** Implemented a multi-step approach in `analyzeMaterialsDetailed` to resolve file IDs and access files:
    1.  **Try Drive API v3 directly:** Attempt access using the Classroom-provided ID and `supportsAllDrives`. This works for standard Drive files or if the ID is directly compatible.
    2.  **Fallback to DriveApp:** If direct v3 access fails with "not found", use `DriveApp.getFileById()` with the Classroom ID. This service often resolves the correct underlying Drive ID.
    3.  **Retry Drive API v3:** Use the confirmed ID from `DriveApp` to retry the `Drive.Files.get()` call with `supportsAllDrives`.
    4.  **AlternateLink Extraction:** If `DriveApp` also fails, extract the file ID from the `alternateLink` provided by the Classroom API and attempt `Drive.Files.get()` with that ID and `supportsAllDrives`.
*   **Refined Error Handling:** Improved logging to distinguish between "File not found" errors (often ID mismatches or permission issues), specific permission errors, and general API access failures.
*   **Exponential Backoff:** Maintained and refined exponential backoff (`Utilities.sleep`) for retrying API calls during temporary server issues.

### Slide Counting Implementation (`analyzeMaterialsDetailed`, `utilities.gs`)

*   **API Requirement:** Added Google Slides API (`Slides.Presentations.get`) to access presentation details.
*   **Identification:** `analyzeMaterialsDetailed` identifies files with the Google Slides MIME type (`application/vnd.google-apps.presentation`) during the Drive file processing loop, using the confirmed Drive ID obtained via the tiered access strategy.
*   **Batch Processing:** Collects the IDs of identified presentations.
*   **Utility Function:** Calls `batchCountSlidesInPresentations` (in `utilities.gs`) after processing all materials.
*   **Batching Logic:** `batchCountSlidesInPresentations` processes IDs in small batches (e.g., 5) to avoid exceeding Slides API quotas.
*   **Individual Counting:** Within the batch, `countSlidesInPresentation` is called for each ID.
*   **Error Handling:** `countSlidesInPresentation` includes checks for correct MIME type (using Drive API first) and handles potential Slides API errors gracefully, returning 0 slides on failure.
*   **Delays:** Includes `Utilities.sleep` calls within and between batches to mitigate rate limiting.
*   **Data Integration:** The slide counts are mapped back to the `materialStats.presentations.files` array and aggregated into `materialStats.presentations.totalSlides`.

## Key Analysis Functions

### Assignment Creation Analysis (`analyzeAssignmentCreation` in `data.gs`)

*   **Input:** Takes the `relevantCourseWork` array (already filtered by date) as input.
*   **Iteration:** Loops through each coursework item.
*   **Date Check:** Skips items without a valid `creationTime`.
*   **Deadline Check:** Checks for the presence of `work.dueDate`.
*   **Aggregation:** Increments counters (`totalAssignments`, `totalWithDeadline`, `totalWithoutDeadline`).
*   **Monthly Breakdown:** Extracts the year and month (`YYYY-MM`) from the `creationTime`.
*   **Mapping:** Increments counts within nested objects (`withDeadlineByMonth`, `withoutDeadlineByMonth`) using the `YYYY-MM` key.
*   **Output:** Returns an object containing the total counts and the monthly breakdown objects.

### Average Submission Time Analysis ("Early Bird" / "Night Owl") (`analyzeAverageSubmissionTimes` in `data.gs`)

*   **Goal:** Identify students with the earliest average submission time in the morning (5am-10am) and the latest average submission time at night (8pm-5am).
*   **Input:** Takes `allStudents`, `relevantCourseWork`, and `allSubmissionsByWorkId`.
*   **Student Iteration:** Loops through each student.
*   **Coursework Iteration:** For each student, loops through `relevantCourseWork`.
*   **Submission Check:** Finds the student's submission for the current coursework item.
*   **Timestamp & Time Calculation:** If a valid submission exists (`TURNED_IN` or `RETURNED`), gets the timestamp using `getSubmissionTimestamp` and calculates the time of day in minutes (0-1439).
*   **Window Check & Aggregation:**
    *   Checks if the submission time falls within the morning window (300-599 minutes) or night window (1200-1439 or 0-299 minutes).
    *   If within a window, adds the time (in minutes) to a running total and increments a counter for that specific window *for that student*.
*   **Window Average Calculation:** After processing all coursework for a student, calculates the average time in minutes for each window (morning/night) *if* the count for that window is greater than 0.
*   **Finding Extrema:**
    *   **Early Bird:** Iterates through all students' calculated average morning times, finding the minimum average.
    *   **Night Owl:** Iterates through all students' calculated average night times. To handle the wrap-around (e.g., 1am is later than 11pm), times are mapped relative to a 5am start (`(avgTime - 300 + 1440) % 1440`), and the maximum *mapped* time is found.
*   **Formatting:** Formats the final average times (in minutes) into `HH:MM` strings.
*   **Output:** Returns an object containing the names and formatted average times for the identified Early Bird and Night Owl students (or `null` if none qualified).

## Performance Considerations

1. **API Rate Limiting**:
   * Implemented strategic delays with `Utilities.sleep` to prevent quota errors
   * Batch processing for operations like slide counting to reduce API pressure
   * Exponential backoff retry mechanism for transient errors

2. **Execution Time Management**:
   * Google Apps Script has a maximum execution time of 6 minutes
   * Implemented progressive status updates to keep users informed during long operations
   * Added cancellation option for lengthy processes

3. **Data Volume Handling**:
   * Efficient data structures (maps/objects) for quick lookups
   * Filtering data early in the pipeline to reduce processing load
   * Centralized data fetching to minimize redundant API calls

## Next Steps & Future Enhancements

1. **Performance Optimizations**:
   * Implement server-side caching using `CacheService` for analysis results
   * Add incremental data loading for very large courses
   * Further optimize presentation slide counting with parallel processing

2. **UI Enhancements**:
   * Add more interactive elements to the visualization
   * Create shareable report links for students
   * Add customizable visualization options

3. **Analysis Extensions**:
   * Implement additional insights metrics
   * Add comparative analysis between courses
   * Create teacher-specific analytics dashboard

4. **Error Handling**:
   * Improve resilience to API changes
   * Add more detailed logging for troubleshooting
   * Implement graceful degradation for features with API limitations

5. **Deployment & Distribution**:
   * Create an Add-on version for easier installation
   * Add automated testing for key functions
   * Create a configuration panel for customization 