/**
 * Classroom Wrapped
 * 
 * This script analyzes Google Classroom data to provide students with 
 * a Spotify Wrapped-style overview of their academic year.
 */

// Global variable for cancellation
let shouldCancelDownload = false;

/**
 * Entry point - shows the web interface
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Classroom Wrapped')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper function to include HTML files
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Lists all available courses
 */
function listCourses() {
  try {
    const response = Classroom.Courses.list();
    if (!response || !response.courses) return [];
    
    return response.courses.map(c => ({
      id: c.id,
      name: c.name
    }));
  } catch (error) {
    Logger.log("Error listing courses: " + error);
    throw new Error("Failed to load courses. Please check permissions.");
  }
}

/**
 * Gets topics for a course
 */
function getTopics(courseId) {
  try {
    // Try direct topics API first
    try {
      const response = Classroom.Courses.Topics.list(courseId);
      if (response && response.topic) {
        return response.topic.map(t => ({
          id: t.topicId,
          name: t.name
        }));
      }
    } catch (e) {
      Logger.log("Topics API failed, falling back to coursework");
    }

    // Fallback: Get topics from coursework
    const courseWork = getAllCourseWork(courseId);
    const topicMap = new Map();
    
    courseWork.forEach(work => {
      if (work.topicId && !topicMap.has(work.topicId)) {
        topicMap.set(work.topicId, {
          id: work.topicId,
          name: work.topic || 'Topic ' + work.topicId
        });
      }
    });

    return Array.from(topicMap.values());
  } catch (error) {
    Logger.log("Error getting topics: " + error);
    throw new Error("Failed to load topics");
  }
}

/**
 * Comprehensive Franklin Wrapped analysis (Placeholder in code.gs, defined in data.gs)
 * @param {string} courseId
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} countSlides
 */
function franklinWrappedAnalysis(courseId, startDate, endDate, countSlides) {
  // Actual implementation is in data.gs
  // This placeholder allows the front-end to call it via google.script.run
}

/**
 * Runs only the slide analysis portion for a course to update presentation statistics
 * @param {string} courseId - The ID of the course to analyze
 * @return {object} An object containing only the updated material statistics with slide counts
 */
function runSlideAnalysisOnly(courseId) {
  try {
    // Get all course materials
    const allMaterials = getAllMaterials(courseId);
    const allCourseWork = getAllCourseWork(courseId);
    
    // We don't need date filtering for this specific operation
    const presentationFileIds = [];
    
    // Process materials to collect presentation IDs
    for (const material of allMaterials) {
      if (material.materials) {
        collectPresentationIds(material.materials, presentationFileIds);
      }
    }
    
    // Process materials attached to coursework
    for (const work of allCourseWork) {
      if (work.materials) {
        collectPresentationIds(work.materials, presentationFileIds);
      }
    }
    
    // Create basic materialStats structure
    const materialStats = {
      presentations: {
        count: presentationFileIds.length,
        totalSlides: 0,
        files: []
      }
    };
    
    // Count slides if we have presentations
    if (presentationFileIds.length > 0) {
      Logger.log(`Counting slides for ${presentationFileIds.length} presentations...`);
      
      // Get slide counts
      const slideCounts = batchCountSlidesInPresentations(presentationFileIds);
      
      // Calculate totals and store details
      let totalSlides = 0;
      for (const fileId of presentationFileIds) {
        const slideCount = slideCounts[fileId] || 0;
        totalSlides += slideCount;
        materialStats.presentations.files.push({
          id: fileId,
          slideCount: slideCount
        });
      }
      
      materialStats.presentations.totalSlides = totalSlides;
      Logger.log(`Slide counting complete. Found ${totalSlides} total slides in ${presentationFileIds.length} presentations.`);
    }
    
    return {
      materialStats: materialStats
    };
  } catch (error) {
    Logger.log("Error in slide analysis: " + error);
    throw new Error("Slide analysis failed: " + error.message);
  }
}

/**
 * Helper function to collect presentation IDs from materials
 * @param {Array} materials - Array of material objects
 * @param {Array} presentationFileIds - Array where presentation IDs will be added
 */
function collectPresentationIds(materials, presentationFileIds) {
  if (!materials) return;
  
  for (const attachment of materials) {
    if (attachment.driveFile && attachment.driveFile.driveFile) {
      const classroomFileId = attachment.driveFile.driveFile.id;
      
      try {
        // Check if file is a presentation
        const file = Drive.Files.get(classroomFileId, {
          fields: 'id,mimeType',
          supportsAllDrives: true
        });
        
        if (file.mimeType === 'application/vnd.google-apps.presentation') {
          // Add to the list if it's a presentation
          if (!presentationFileIds.includes(file.id)) {
            presentationFileIds.push(file.id);
          }
        }
      } catch (error) {
        Logger.log(`Error checking file ${classroomFileId}: ${error}`);
        // Continue to next file
      }
    }
  }
}

/**
 * Fetches the most recent server logs for display in the UI
 * @param {number} maxLines - Maximum number of log lines to return (default 100)
 * @return {Array<object>} Array of log entries with timestamp, message, and level
 */
function getServerLogs(maxLines = 100) {
  try {
    // Create a structured log array from Logger logs
    const logEntries = [];
    
    // Get logs as string from Logger
    const logs = Logger.getLog().split('\n');
    
    // Process the most recent logs (limited by maxLines)
    const recentLogs = logs.slice(-maxLines);
    
    // Parse each log line
    for (const log of recentLogs) {
      if (!log.trim()) continue; // Skip empty lines
      
      // Extract timestamp if available (Logger format: "MMM d, yyyy h:mm:ss a message")
      let timestamp = null;
      let message = log;
      let level = 'info';
      
      // Extract timestamp from log line if present
      const timestampMatch = log.match(/^([A-Z][a-z]{2} \d{1,2}, \d{4} \d{1,2}:\d{2}:\d{2} [AP]M)\s+(.*)/);
      if (timestampMatch) {
        timestamp = timestampMatch[1];
        message = timestampMatch[2];
      }
      
      // Detect error levels based on message content
      if (message.toLowerCase().includes('error')) {
        level = 'error';
      } else if (message.toLowerCase().includes('warning') || message.toLowerCase().includes('failed')) {
        level = 'warning';
      }
      
      logEntries.push({
        timestamp,
        message,
        level
      });
    }
    
    return logEntries;
  } catch (error) {
    console.error("Error fetching server logs:", error);
    return [{
      timestamp: new Date().toLocaleString(),
      message: "Failed to retrieve server logs: " + error.message,
      level: 'error'
    }];
  }
}

/**
 * Cancels the current operation by setting the global flag
 */
function cancelOperation() {
  shouldCancelDownload = true;
  Logger.log("Cancel flag set - operation will terminate at next checkpoint");
  return true;
}

/**
 * Logs user access to the app
 */
function logAccess() {
  try {
    const user = Session.getActiveUser().getEmail();
    Logger.log("App accessed by: " + user);
    return { success: true, user: user };
  } catch (error) {
    Logger.log("Error logging access: " + error);
    return { success: false, error: error.toString() };
  }
}