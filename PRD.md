# Classroom Wrapped - Product Requirements Document

## Overview
Classroom Wrapped is a Google Apps Script application that analyzes Google Classroom data to provide students with a Spotify Wrapped-style overview of their academic year. The tool generates engaging visualizations and statistics about student activities, submissions, and engagement throughout the school year.

## Target Users
- Teachers who want to provide students with insights about their learning journey
- Students who want to reflect on their academic year
- Educational institutions looking to increase student engagement

## Requirements

### Core Features

#### 1. Submission Analytics
- **Total submissions count** with visualization
- **On-time vs. late submissions** breakdown (pie chart)
- **Submission timeline** showing activity patterns throughout the year (bar chart by month)
- **Submission activity hotspots** (radar chart by day of week, line chart by hour)
- **Completion rate** across assignments in the selected period
- **Student file uploads**: Total count, timeline (line chart by month), type breakdown (doughnut chart)

#### 2. ~~Feedback Analysis~~ (Removed)
- *Analysis of private comments is not feasible via API.*

#### 3. Material & Assignment Insights
- **Material uploads** statistics (count, size, file types)
- **Google Slides analysis**: Count of presentations, total slides, average slides/presentation, list of presentations with slide counts.
- **Assignment creation timeline**: Stacked bar chart showing assignments created per month (with vs. without deadline).

#### 4. Engagement & Timing Metrics
- **Top students** based on submission count (horizontal bar chart)
- **Average submission timing**: Identification of "Early Bird" (earliest avg. morning time) and "Night Owl" (latest avg. night time) students.

#### 5. Visual Presentation & Export
- **Spotify-Wrapped style interface** with animated charts and stat cards
- **Multiple chart types**: Pie, Bar, Line, Radar, Doughnut, Stacked Bar
- **CSV Data Export**: Option to download summary statistics, with student name anonymization feature.

### Technical Requirements

#### Data Access
- Use Google Classroom API to access course data, assignments, submissions
- Use Google Drive API for file metadata analysis
- Implement proper authentication and authorization flows

#### Data Processing
- Efficient algorithms for analyzing large sets of classroom data
- Temporary data caching to improve performance
- Data anonymization options for sharing aggregate insights

#### UI/UX
- Responsive design for both desktop and mobile viewing
- Animated transitions between different stats
- Color-coded visualizations
- Accessibility compliance

## Phases of Implementation

### Phase 1: Core Analytics Engine
- Course selection interface
- Basic data collection from Google Classroom
- Core metrics calculation (submissions, feedback)

### Phase 2: Visualization Development
- Design and implement the Wrapped-style interface
- Create interactive charts and graphs
- Develop the student summary view

### Phase 3: Advanced Features
- Implement engagement metrics
- Add sharing capabilities
- Optimize performance for large courses

## Success Metrics
- User adoption rate (percentage of teachers using the tool)
- Student engagement with the wrapped summaries
- Qualitative feedback from teachers and students

## Constraints
- Google Classroom API limitations
- Privacy considerations for student data
- Performance constraints of Google Apps Script environment

## Technical Notes

### Codebase Structure
The application has been refactored from a monolithic structure to a modular architecture with the following components:

1. **Server-Side Code**:
   - `code.gs` - Core functions and entry points
   - `data.gs` - Data processing and analytics functions
   - `utilities.gs` - Helper utility functions

2. **Client-Side Code**:
   - `Index.html` - Main HTML structure
   - `Styles.html` - CSS styling
   - `Scripts.html` - Client-side JavaScript

### Known Issues
- **Function references**: Some server-side functions may not be properly connected to client-side calls (Needs review after recent refactoring).

### Next Steps
- **Test and validate data processing functions:** Verify the integrated `franklinWrappedAnalysis` and helper functions work correctly.
- **Develop and test visualization components:** Implement the Wrapped-style UI based on collected data.
- **Review client-server function calls:** Ensure `Scripts.html` correctly calls the intended server-side functions (e.g., `franklinWrappedAnalysis`).
- *Note:* Removed the requirement for automatic Google Drive folder creation for initial release. 