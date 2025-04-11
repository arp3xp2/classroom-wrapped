/**
 * Utilities for Classroom Wrapped application
 */

/**
 * Formats a date object to a readable string
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString();
}

/**
 * Cleanses student name for file and folder names
 */
function cleanseStudentName(student) {
  if (!student) return 'Unknown Student';
  
  // Get clean student name - ensure it's a string
  const rawStudentName = student.profile.name || student.profile.emailAddress || student.userId.toString();
  const studentName = String(rawStudentName); // Force conversion to string
  
  // Try to extract first and last name consistently
  let firstName = "";
  let lastName = "";
  
  // Check if we have structured name data
  if (student.profile.name && student.profile.name.givenName) {
    firstName = student.profile.name.givenName;
    lastName = student.profile.name.familyName || "";
  } 
  // Otherwise parse from the full name
  else {
    // Remove prefixes first
    const cleanedName = studentName.replace(/fullName|givenName|familyName/g, '');
    
    // Split by spaces and remove duplicates
    const nameParts = cleanedName.split(/\s+/).filter(part => part.trim().length > 0);
    const uniqueParts = [...new Set(nameParts)];
    
    if (uniqueParts.length >= 2) {
      firstName = uniqueParts[0];
      lastName = uniqueParts[uniqueParts.length - 1];
    } else if (uniqueParts.length === 1) {
      firstName = uniqueParts[0];
      lastName = "";
    }
  }
  
  // Construct a consistent name format: "FirstName LastName"
  let cleanStudentName = firstName;
  if (lastName) {
    cleanStudentName += " " + lastName;
  }
  
  // Clean up any remaining special characters
  cleanStudentName = cleanStudentName
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // If name is empty, use a fallback
  if (!cleanStudentName) {
    cleanStudentName = "Student-" + student.userId;
  }
  
  return cleanStudentName;
}

/**
 * Generates colors for charts based on the number of items needed
 */
function generateColors(count) {
  const colors = [
    '#4285F4', // Google Blue
    '#EA4335', // Google Red
    '#FBBC05', // Google Yellow
    '#34A853', // Google Green
    '#8ab4f8', // Light Blue
    '#f28b82', // Light Red
    '#fdd663', // Light Yellow
    '#81c995', // Light Green
    '#b9d4f6', // Lighter Blue
    '#f6aea9', // Lighter Red
    '#fce8b2', // Lighter Yellow
    '#a8dab5'  // Lighter Green
  ];
  
  // Return either the colors we have or generate extras if needed
  if (count <= colors.length) {
    return colors.slice(0, count);
  }
  
  // If we need more colors, generate them
  const result = [...colors];
  
  for (let i = colors.length; i < count; i++) {
    const hue = (i * 137.5) % 360; // Use golden angle approximation for distribution
    result.push(`hsl(${hue}, 70%, 60%)`);
  }
  
  return result;
}

/**
 * Groups items by a date field for timeline analysis
 */
function groupByDate(items, dateField, valueField) {
  const grouped = {};
  
  items.forEach(item => {
    if (!item[dateField]) return;
    
    const date = new Date(item[dateField]);
    const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = 0;
    }
    
    grouped[dateKey] += valueField ? item[valueField] : 1;
  });
  
  return grouped;
}

/**
 * Detects if a specific term is in the user's language
 */
function isSemesterTerm() {
  const userLanguage = Session.getActiveUserLocale();
  
  // If the user's language is German, use the word Semester
  if (userLanguage.startsWith('de')) {
    return true;
  }
  
  return false;
}

/**
 * Calculates time periods for date filters
 */
function getTimePeriodDates(timePeriod) {
  const now = new Date();
  let startDate = null;
  let endDate = now;
  
  switch (timePeriod) {
    case 'semester':
      // Determine current semester
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      if (currentMonth >= 8) {
        // Fall/Winter semester
        startDate = new Date(currentYear, 7, 1); // August 1st
      } else if (currentMonth >= 1 && currentMonth <= 7) {
        // Spring/Summer semester
        startDate = new Date(currentYear, 0, 1); // January 1st
      }
      break;
      
    case 'year':
      // Last 365 days
      startDate = new Date();
      startDate.setFullYear(now.getFullYear() - 1);
      break;
      
    case 'all':
    default:
      // All time - no filtering
      startDate = null;
      break;
  }
  
  return {
    startDate: startDate,
    endDate: endDate
  };
}

/**
 * Creates a chart image and returns it as a blob
 */
function createChart(chartData, chartOptions) {
  // Implement chart creation - this would be expanded in a real implementation
  // For now, just create a dummy image
  return Utilities.newBlob('Chart placeholder', 'image/png', 'chart.png');
}

/**
 * Counts the number of slides in a presentation
 * @param {string} fileId - The ID of the presentation file (should be the confirmed Drive ID)
 * @return {number} The number of slides in the presentation
 */
function countSlidesInPresentation(fileId) {
  try {
    // We assume the fileId passed here is the confirmed Drive ID
    
    // Verify mime type using Drive API v3 with supportsAllDrives
    try {
      const fileMetadata = Drive.Files.get(fileId, {
        fields: 'mimeType,name',
        supportsAllDrives: true
      });
      
      if (fileMetadata.mimeType !== 'application/vnd.google-apps.presentation') {
        Logger.log(`File ${fileId} (${fileMetadata.name || 'N/A'}) is not a Google Slides presentation. MimeType: ${fileMetadata.mimeType}`);
        return 0;
      }
    } catch (driveError) {
      // If even checking mime type fails, log and return 0
      Logger.log(`Drive API error checking file type for ${fileId}: ${driveError}`);
      return 0;
    }
    
    // Get the presentation using the Slides API
    const presentation = Slides.Presentations.get(fileId);
    
    // Return the number of slides
    return presentation.slides ? presentation.slides.length : 0;
  } catch (error) {
    Logger.log(`Error counting slides in presentation ${fileId}: ${error}`);
    return 0; // Return 0 if there's an error
  }
}

/**
 * Batch count slides for multiple presentations
 * @param {Array<string>} fileIds - Array of presentation file IDs
 * @return {Object} Map of file IDs to slide counts
 */
function batchCountSlidesInPresentations(fileIds) {
  const slideCounts = {};
  
  // Process in smaller batches to avoid rate limits
  const batchSize = 5; // Reduced from 10 to 5
  for (let i = 0; i < fileIds.length; i += batchSize) {
    const batch = fileIds.slice(i, i + batchSize);
    
    for (const fileId of batch) {
      slideCounts[fileId] = countSlidesInPresentation(fileId);
      
      // Add a longer delay to avoid hitting rate limits
      if (batch.length > 1) {
        Utilities.sleep(500); // Increased from 100ms to 500ms
      }
    }
    
    // Add a pause between batches
    if (i + batchSize < fileIds.length) {
      Utilities.sleep(1000); // 1 second pause between batches
    }
  }
  
  return slideCounts;
} 