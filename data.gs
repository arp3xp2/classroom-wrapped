/**
 * Data processing functions for Classroom Wrapped
 */

/**
 * Helper functions to retrieve data from Google Classroom
 */
function getAllStudents(courseId) {
  const students = [];
  let pageToken = null;
  
  do {
    const response = Classroom.Courses.Students.list(courseId, { pageToken: pageToken });
    if (response.students) students.push(...response.students);
    pageToken = response.nextPageToken;
  } while (pageToken);
  
  return students;
}

function getAllCourseWork(courseId) {
  const courseWork = [];
  let pageToken = null;
  
  do {
    const response = Classroom.Courses.CourseWork.list(courseId, { pageToken: pageToken });
    if (response.courseWork) courseWork.push(...response.courseWork);
    pageToken = response.nextPageToken;
  } while (pageToken);
  
  return courseWork;
}

function getAllSubmissions(courseId, courseWorkId) {
  const submissions = [];
  let pageToken = null;
  
  do {
    const response = Classroom.Courses.CourseWork.StudentSubmissions.list(
      courseId, 
      courseWorkId, 
      { 
        pageToken: pageToken,
        fields: '*' // Request all fields for debugging
      }
    );
    if (response.studentSubmissions) submissions.push(...response.studentSubmissions);
    pageToken = response.nextPageToken;
  } while (pageToken);
  
  return submissions;
}

function getAllMaterials(courseId) {
  const materials = [];
  let pageToken = null;

  do {
    const response = Classroom.Courses.CourseWorkMaterials.list(courseId, { pageToken: pageToken });
    if (response.courseWorkMaterial) materials.push(...response.courseWorkMaterial);
    pageToken = response.nextPageToken;
  } while (pageToken);

  return materials;
}

/**
 * Filters course work by date and fetches submissions only for relevant items.
 * @param {string} courseId - The ID of the course.
 * @param {Array<object>} allCourseWork - The pre-fetched list of all coursework.
 * @param {Date|null} startDate - Optional start date for filtering.
 * @param {Date|null} endDate - Optional end date for filtering.
 * @return {{relevantCourseWork: Array<object>, allSubmissionsByWorkId: object}} - An object containing the filtered coursework and a map of submissions.
 */
function filterAndFetchSubmissions(courseId, allCourseWork, startDate, endDate) {
  const allSubmissionsByWorkId = {};
  const relevantCourseWork = [];
  let relevantWorkCount = 0;

  Logger.log('Filtering coursework and fetching relevant submissions...');

  for (const work of allCourseWork) {
    if (shouldCancelDownload) throw new Error("Operation was cancelled during submission fetch prep.");

    // Filter coursework by date
    const creationDate = new Date(work.creationTime);
    if (startDate && creationDate < startDate) continue;
    if (endDate && creationDate > endDate) continue;
    
    // If within date range, it's relevant
    relevantCourseWork.push(work);
    
    // Fetch submissions only for this relevant coursework item
    try {
        allSubmissionsByWorkId[work.id] = getAllSubmissions(courseId, work.id);
        relevantWorkCount++;
        // Log progress periodically to avoid flooding logs
        if (relevantWorkCount % 10 === 0) {
            Logger.log(`Fetched submissions for ${relevantWorkCount} relevant coursework items...`);
        }
    } catch(e) {
        Logger.log(`ERROR: Failed to fetch submissions for coursework ${work.id}: ${e.toString()}. Skipping this item.`);
        // Optionally remove the partially added work from relevantCourseWork if submissions fail?
        // For now, keep it in relevantCourseWork but its submissions will be empty/missing.
    }
  }

  Logger.log(`Submission fetching complete. Found ${relevantCourseWork.length} relevant coursework items within the date range.`);
  return { relevantCourseWork, allSubmissionsByWorkId };
}

/**
 * Analytics functions
 */

/**
 * Gets submission statistics for a student
 */
function getSubmissionStats(courseId, optionalStudentId) {
  try {
    // Get all course work
    const courseWork = getAllCourseWork(courseId);
    
    // If no assignments, return empty stats
    if (!courseWork || courseWork.length === 0) {
      return {
        total: 0,
        onTime: 0,
        late: 0,
        missing: 0,
        timeline: []
      };
    }
    
    // Initialize statistics
    const stats = {
      total: 0,
      onTime: 0,
      late: 0,
      missing: 0,
      timeline: [] // Will hold submission dates
    };
    
    // Process each assignment
    for (const assignment of courseWork) {
      // Get all submissions or filter by student
      const submissions = getAllSubmissions(courseId, assignment.id);
      const filteredSubmissions = optionalStudentId 
        ? submissions.filter(s => s.userId === optionalStudentId)
        : submissions;
      
      if (shouldCancelDownload) {
        throw new Error("Operation was cancelled");
      }
      
      // Process each submission
      for (const submission of filteredSubmissions) {
        stats.total++;
        
        // Count by state
        switch (submission.state) {
          case 'TURNED_IN':
          case 'RETURNED':
            // Check if late
            if (submission.late) {
              stats.late++;
            } else {
              stats.onTime++;
            }
            
            // Add to timeline if we have a submission time
            if (submission.submissionHistory) {
              const historyWithTime = submission.submissionHistory.find(h => h.stateHistory && h.stateHistory.stateTimestamp);
              if (historyWithTime && historyWithTime.stateHistory) {
                stats.timeline.push({
                  date: historyWithTime.stateHistory.stateTimestamp,
                  assignmentTitle: assignment.title,
                  late: submission.late || false
                });
              }
            }
            break;
            
          case 'CREATED':
          case 'NEW':
            stats.missing++;
            break;
        }
      }
    }
    
    // Sort timeline chronologically
    stats.timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return stats;
  } catch (error) {
    Logger.log("Error getting submission stats: " + error);
    throw new Error("Failed to analyze submissions: " + error.message);
  }
}

/**
 * Gets feedback statistics
 */
function getFeedbackStats(courseId, optionalStudentId) {
  try {
    // Get all course work
    const courseWork = getAllCourseWork(courseId);
    
    // Initialize statistics
    const stats = {
      totalComments: 0,
      totalWords: 0,
      longestComment: 0,
      commentsByMonth: {},
      wordsByMonth: {}
    };
    
    // Process each assignment
    for (const assignment of courseWork) {
      // Get all submissions or filter by student
      const submissions = getAllSubmissions(courseId, assignment.id);
      const filteredSubmissions = optionalStudentId 
        ? submissions.filter(s => s.userId === optionalStudentId)
        : submissions;
      
      if (shouldCancelDownload) {
        throw new Error("Operation was cancelled");
      }
      
      // Process each submission
      for (const submission of filteredSubmissions) {
        // Check for teacher comments
        if (submission.assignmentSubmission && submission.assignmentSubmission.attachments) {
          for (const attachment of submission.assignmentSubmission.attachments) {
            if (attachment.driveFile && attachment.driveFile.comments) {
              // Process each comment
              attachment.driveFile.comments.forEach(comment => {
                if (comment.createdBy && comment.createdBy.role === 'TEACHER') {
                  // Count comment
                  stats.totalComments++;
                  
                  // Count words
                  const wordCount = comment.content.split(/\s+/).filter(word => word.length > 0).length;
                  stats.totalWords += wordCount;
                  
                  // Track longest comment
                  if (wordCount > stats.longestComment) {
                    stats.longestComment = wordCount;
                  }
                  
                  // Track by month
                  if (comment.timestamp) {
                    const date = new Date(comment.timestamp);
                    const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
                    
                    if (!stats.commentsByMonth[month]) {
                      stats.commentsByMonth[month] = 0;
                      stats.wordsByMonth[month] = 0;
                    }
                    
                    stats.commentsByMonth[month]++;
                    stats.wordsByMonth[month] += wordCount;
                  }
                }
              });
            }
          }
        }
      }
    }
    
    return stats;
  } catch (error) {
    Logger.log("Error getting feedback stats: " + error);
    throw new Error("Failed to analyze feedback: " + error.message);
  }
}

/**
 * Gets material statistics
 */
function getMaterialStats(courseId) {
  try {
    // Get all materials
    const materials = getAllMaterials(courseId);
    
    // Initialize statistics
    const stats = {
      totalCount: 0,
      byType: {},
      byMonth: {}
    };
    
    // Process materials
    for (const material of materials) {
      stats.totalCount++;
      
      // Track by creation date
      if (material.creationTime) {
        const date = new Date(material.creationTime);
        const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!stats.byMonth[month]) {
          stats.byMonth[month] = 0;
        }
        
        stats.byMonth[month]++;
      }
      
      // Analyze materials
      if (material.materials) {
        for (const materialItem of material.materials) {
          let type = 'other';
          
          if (materialItem.driveFile) {
            type = materialItem.driveFile.driveFile.title.split('.').pop().toLowerCase() || 'document';
          } else if (materialItem.youtubeVideo) {
            type = 'youtube';
          } else if (materialItem.link) {
            type = 'link';
          } else if (materialItem.form) {
            type = 'form';
          }
          
          if (!stats.byType[type]) {
            stats.byType[type] = 0;
          }
          
          stats.byType[type]++;
        }
      }
    }
    
    return stats;
  } catch (error) {
    Logger.log("Error getting material stats: " + error);
    throw new Error("Failed to analyze materials: " + error.message);
  }
}

/**
 * Main analysis function
 */
function analyzeClassroom(courseId, analysisType, studentId) {
  try {
    // Reset cancel flag
    shouldCancelDownload = false;
    
    // Set up results
    const results = {
      courseId: courseId,
      courseDetails: Classroom.Courses.get(courseId),
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    // Run appropriate analysis based on type
    switch (analysisType) {
      case 'submissions':
        results.data = getSubmissionStats(courseId, studentId);
        break;
        
      case 'feedback':
        results.data = getFeedbackStats(courseId, studentId);
        break;
        
      case 'materials':
        results.data = getMaterialStats(courseId);
        break;
        
      case 'all':
      default:
        results.data = {
          submissions: getSubmissionStats(courseId, studentId),
          feedback: getFeedbackStats(courseId, studentId),
          materials: getMaterialStats(courseId)
        };
        break;
    }
    
    return results;
  } catch (error) {
    Logger.log("Error in classroom analysis: " + error);
    throw new Error("Analysis failed: " + error.message);
  }
}

/**
 * Franklin Wrapped Analysis Functions
 * These functions are extracted from the Franklin Wrapped code
 * and adapted to work with the Classroom Wrapped interface
 */

/**
 * Analyzes submissions (on-time vs. late) using pre-fetched data
 * @param {Array<object>} relevantCourseWork - The list of coursework objects already filtered by date
 * @param {object} allSubmissionsByWorkId - A map where keys are courseWorkIds and values are arrays of submissions
 * @return {object} An object containing submission stats (onTime, late, total)
 */
function analyzeSubmissions(relevantCourseWork, allSubmissionsByWorkId, studentCount) {
  Logger.log('Analyzing submissions...');

  const submissionStats = {
    onTimeSubmissions: 0,
    lateSubmissions: 0,
    totalSubmissions: 0,
    completionRate: 0,
    submissionsByMonth: {},
    totalStudentFiles: 0, 
    studentFilesByMonth: {},
    submissionsByDay: Array(7).fill(0), // Index 0 = Sunday, ..., 6 = Saturday
    submissionsByHour: Array(24).fill(0), // Index 0 = 12am-1am, ..., 23 = 11pm-12am
    submissionRatesByAssignment: {}, // { assignmentId: { title: '...', submitted: 0, rate: 0 } }
    studentAttachmentTypes: { driveFile: 0, youtubeVideo: 0, link: 0, form: 0, other: 0 } // Counts
  };

  for (const work of relevantCourseWork) {
    const submissions = allSubmissionsByWorkId[work.id] || [];
    let submittedCountForWork = 0;

    if (shouldCancelDownload) {
      throw new Error("Operation was cancelled");
    }

    for (const submission of submissions) {
      if (submission.state === 'TURNED_IN' || submission.state === 'RETURNED') {
        submissionStats.totalSubmissions++;
        submittedCountForWork++;

        const submissionDate = getSubmissionTimestamp(submission);
        if (submissionDate) {
          // Track by month
          const month = `${submissionDate.getFullYear()}-${String(submissionDate.getMonth() + 1).padStart(2, '0')}`;
          submissionStats.submissionsByMonth[month] = (submissionStats.submissionsByMonth[month] || 0) + 1;
          
          // Track by day of week & hour
          submissionStats.submissionsByDay[submissionDate.getDay()]++;
          submissionStats.submissionsByHour[submissionDate.getHours()]++;
        }

        // Count if late or on time
        if (submission.late) {
          submissionStats.lateSubmissions++;
        } else {
          submissionStats.onTimeSubmissions++;
        }

        // Count student attachments
        if (submission.assignmentSubmission && submission.assignmentSubmission.attachments) {
          const attachments = submission.assignmentSubmission.attachments;
          const fileCount = attachments.length;
          submissionStats.totalStudentFiles += fileCount;
          
          // Track student files by month - only if submissionDate is valid
          if (submissionDate) { 
             const month = `${submissionDate.getFullYear()}-${String(submissionDate.getMonth() + 1).padStart(2, '0')}`;
             submissionStats.studentFilesByMonth[month] = (submissionStats.studentFilesByMonth[month] || 0) + fileCount;
          }
          
          // Track attachment types
          attachments.forEach(att => {
            if (att.driveFile) submissionStats.studentAttachmentTypes.driveFile++;
            else if (att.youtubeVideo) submissionStats.studentAttachmentTypes.youtubeVideo++;
            else if (att.link) submissionStats.studentAttachmentTypes.link++;
            else if (att.form) submissionStats.studentAttachmentTypes.form++;
            else submissionStats.studentAttachmentTypes.other++;
          });
        }
      }
    } // End submissions loop

    // Calculate submission rate for this assignment
    // Need total student count - this should be passed in or fetched earlier
    // For now, let's placeholder this - requires fetching student count
    /* TODO: Need student count to calculate rate accurately
    const totalStudents = ???; // Placeholder - fetch student count for the course
    const submissionRate = (totalStudents > 0) ? Math.round((submittedCountForWork / totalStudents) * 100) : 0;
    submissionStats.submissionRatesByAssignment[work.id] = {
      title: work.title,
      submitted: submittedCountForWork,
      rate: submissionRate
    };
    */
    // Simple version for now: store submitted count
     submissionStats.submissionRatesByAssignment[work.id] = {
      title: work.title,
      submitted: submittedCountForWork
    };

  } // End coursework loop

  // Calculate completion rate
  if (submissionStats.totalSubmissions > 0) {
    submissionStats.completionRate = Math.round((submissionStats.onTimeSubmissions / submissionStats.totalSubmissions) * 100);
  }

  Logger.log(`Submissions analyzed: ${submissionStats.onTimeSubmissions} on time, ${submissionStats.lateSubmissions} late, ${submissionStats.totalSubmissions} total`);
  return submissionStats;
}

/**
 * Analyzes material uploads (count, size, type) using pre-fetched data
 * @param {Array<object>} relevantCourseWork - The list of coursework objects already filtered by date
 * @param {Array<object>} allMaterials - The list of all coursework materials for the course
 * @param {Date} startDate - Optional start date for filtering (still needed for materials)
 * @param {Date} endDate - Optional end date for filtering (still needed for materials)
 * @param {boolean} countSlides - Whether to perform the potentially long-running slide count
 * @return {object} An object containing material stats (count, byType, totalSizeMB, byMonth)
 */
function analyzeMaterialsDetailed(relevantCourseWork, allMaterials, startDate, endDate, countSlides) {
  Logger.log('Analyzing materials in detail...');

  const materialStats = {
    count: 0,
    byType: {},
    totalSize: 0, // Keep raw size for calculation
    totalSizeMB: 0,
    byMonth: {},
    presentations: {
      count: 0,
      totalSlides: 0,
      files: [] // Will hold details of each presentation
    }
  };

  // Track presentation file IDs for later batch processing
  const presentationFileIds = [];

  // Helper function to process attachments, now returns if a presentation was found
  const processAttachments = (attachments, collectPresentationIds) => {
    if (!attachments) return;
    for (const attachment of attachments) {
      let simpleType = 'unknown';

      if (attachment.driveFile && attachment.driveFile.driveFile) {
        const classroomFileId = attachment.driveFile.driveFile.id;
        let file = null;
        let retries = 3;
        let success = false;
        let confirmedDriveId = null;

        while (retries > 0 && !success) {
          try {
            confirmedDriveId = classroomFileId; // Assume Classroom ID works initially

            // Attempt 1: Use Drive API v3 directly with supportsAllDrives=true
            try {
              file = Drive.Files.get(confirmedDriveId, {
                fields: 'id,mimeType,name,size,webViewLink',
                supportsAllDrives: true
              });

              // If we got here, the ID was correct or it was a normal Drive file
              success = true;
              Logger.log(`Successfully accessed file ${confirmedDriveId} using Drive API v3 directly.`);

            } catch (driveV3Error) {
              const errorMsgV3 = driveV3Error.toString();
              // Check if it's an ID mismatch / not found error
              if (errorMsgV3.includes("File not found") || errorMsgV3.includes("nicht gefunden")) {
                Logger.log(`Drive API v3 direct access failed for ${confirmedDriveId} (File not found/ID mismatch?). Trying DriveApp fallback...`);
                
                // Attempt 2: Use DriveApp as a fallback to resolve ID
                try {
                  const driveAppFile = DriveApp.getFileById(classroomFileId);
                  confirmedDriveId = driveAppFile.getId(); // Get the confirmed ID
                  
                  // Retry Drive API v3 with the confirmed ID
                  file = Drive.Files.get(confirmedDriveId, {
                    fields: 'id,mimeType,name,size,webViewLink',
                    supportsAllDrives: true
                  });
                  success = true;
                   Logger.log(`Successfully accessed file ${confirmedDriveId} using DriveApp ID resolution.`);
                   
                } catch (driveAppError) {
                  Logger.log(`DriveApp fallback also failed for ${classroomFileId}: ${driveAppError}. Trying alternateLink...`);
                  // Attempt 3: Use alternateLink extraction
                  if (attachment.driveFile.driveFile.alternateLink) {
                    const alternateLink = attachment.driveFile.driveFile.alternateLink;
                    const extractedIdMatch = alternateLink.match(/[-\w]{25,}/);
                    
                    if (extractedIdMatch && extractedIdMatch[0]) {
                      confirmedDriveId = extractedIdMatch[0];
                      file = Drive.Files.get(confirmedDriveId, {
                        fields: 'id,mimeType,name,size,webViewLink',
                        supportsAllDrives: true
                      });
                      success = true;
                      Logger.log(`Successfully accessed file ${confirmedDriveId} using alternateLink.`);
                    } else {
                      Logger.log(`Could not extract valid ID from alternateLink: ${alternateLink}`);
                      throw new Error("All access methods failed (DriveApp, alternateLink).");
                    }
                  } else {
                     Logger.log(`No alternateLink available for ${classroomFileId}`);
                     throw new Error("All access methods failed (DriveApp, no alternateLink).");
                  }
                }
              } else {
                // If it wasn't a "File not found" error, re-throw it to trigger retry logic
                throw driveV3Error;
              }
            }

            // If successful, process the file info
            if (success && file) {
              materialStats.totalSize += Number(file.size) || 0;
              simpleType = simplifyMimeType(file.mimeType);

              // *** MODIFICATION START: Only collect presentation IDs if requested ***
              if (collectPresentationIds && (simpleType === 'presentation' || file.mimeType === 'application/vnd.google-apps.presentation')) {
                presentationFileIds.push(confirmedDriveId);
                materialStats.presentations.count++; // Count presentations only when collecting IDs
                materialStats.presentations.files.push({
                  id: confirmedDriveId,
                  name: file.name || "Unnamed Presentation",
                  url: file.webViewLink || `https://docs.google.com/presentation/d/${confirmedDriveId}/edit`,
                  slides: 0 // Will be filled later
                });
              }
              // *** MODIFICATION END ***
            }
            
          } catch (e) {
            // Handle general errors and retry logic
            retries--;
            const errorMsg = e.toString();
            Logger.log(`Error accessing file ${classroomFileId} (Confirmed ID: ${confirmedDriveId || 'N/A'}). Retries left: ${retries}. Error: ${errorMsg}`);
            
            // Check if it's a permission error specifically
            if (errorMsg.includes("does not have permission")) {
              Logger.log(`Permission error detected for file ${classroomFileId}. Skipping retries.`);
              simpleType = 'permission_error';
              break; // Exit retry loop for permission errors
            } 
            // Break immediately for not found errors already handled above or final failure
            else if (errorMsg.includes("All access methods failed") || simpleType === 'file_not_found') { 
                 simpleType = 'drive_access_error'; // Or keep as file_not_found if already set?
                 break;
            }
            
            // If retries remain, back off
            if (retries > 0) {
              const backoffSeconds = Math.pow(2, 4 - retries); // 8s, 16s, 32s
              Logger.log(`Backing off for ${backoffSeconds} seconds before retry...`);
              Utilities.sleep(backoffSeconds * 1000);
            } else {
              simpleType = 'drive_access_error'; // Final failure after retries
            }
          }
        }
        
        // Log final failure if access was not successful
        if (!success) {
             Logger.log(`Failed to access Drive file ${classroomFileId} using all methods.`);
             // Set type based on whether we know it was not found/permission error or general failure
             if (simpleType !== 'file_not_found' && simpleType !== 'permission_error') {
                simpleType = 'drive_access_error';
             }
        }

      } else if (attachment.youtubeVideo) {
        simpleType = 'video';
      } else if (attachment.link) {
        simpleType = 'link';
      } else if (attachment.form) {
        simpleType = 'form';
      }
      // Increment the count for the determined simpleType (always do this)
      materialStats.byType[simpleType] = (materialStats.byType[simpleType] || 0) + 1;
    }
  };

  // Process CourseWorkMaterials (these are standalone materials, not tied to assignments)
  for (const material of allMaterials) {
    // Filter standalone materials by date
    const creationDate = new Date(material.creationTime);
    if (startDate && creationDate < startDate) continue;
    if (endDate && creationDate > endDate) continue;

    materialStats.count++; // Count the material item itself
    const month = `${creationDate.getFullYear()}-${String(creationDate.getMonth() + 1).padStart(2, '0')}`;
    materialStats.byMonth[month] = (materialStats.byMonth[month] || 0) + 1;

    // *** MODIFICATION: Call processAttachments with collectPresentationIds = true ***
    processAttachments(material.materials, true);
  }

  // Process materials attached to the RELEVANT CourseWork (already date-filtered)
  for (const work of relevantCourseWork) {
    // We still want to analyze the *types* and *size* of attachments in coursework,
    // but we don't want to count slides from them.
    if (work.materials && work.materials.length > 0) {
        // We could optionally count the assignment itself towards the material *count*
        // if it has attachments. Let's keep the previous logic for now which counts it.
        // If you want to *only* count standalone materials, remove the next 3 lines.
        materialStats.count++; // Count assignment *if* it has materials
        const creationDate = new Date(work.creationTime);
        const month = `${creationDate.getFullYear()}-${String(creationDate.getMonth() + 1).padStart(2, '0')}`;
        materialStats.byMonth[month] = (materialStats.byMonth[month] || 0) + 1; // Increment count for the month

        // *** MODIFICATION: Call processAttachments with collectPresentationIds = false ***
        processAttachments(work.materials, false);
    }
  }

  // Now count slides *only* for presentations collected from standalone materials
  if (countSlides && presentationFileIds.length > 0) {
    Logger.log(`Counting slides for ${presentationFileIds.length} presentations found in standalone materials...`);
    try {
      const slideCounts = batchCountSlidesInPresentations(presentationFileIds);
      
      // Update our statistics with the slide counts
      materialStats.presentations.files.forEach(presentation => {
        const slideCount = slideCounts[presentation.id] || 0;
        presentation.slides = slideCount;
        materialStats.presentations.totalSlides += slideCount;
      });
      
      Logger.log(`Slide counting complete. Found ${materialStats.presentations.totalSlides} total slides in ${materialStats.presentations.count} presentations.`);
    } catch (error) {
      Logger.log(`Error counting slides: ${error}`);
      // Continue with analysis even if slide counting fails
    }
  }

  // Convert size to MB for display
  materialStats.totalSizeMB = Math.round(materialStats.totalSize / (1024 * 1024) * 10) / 10;

  Logger.log(`Materials analyzed: ${materialStats.count} total, ${materialStats.totalSizeMB} MB, ${materialStats.presentations.count} presentations with ${materialStats.presentations.totalSlides} slides`);
  return materialStats;
}

/**
 * Tries to collect student engagement data using pre-fetched data
 * @param {Array<object>} relevantCourseWork - The list of coursework objects already filtered by date
 * @param {object} allSubmissionsByWorkId - A map where keys are courseWorkIds and values are arrays of submissions
 * @param {Array<object>} allStudents - The list of all students in the course
 * @return {object} An object containing engagement stats (studentInteractions)
 */
function collectEngagementData(relevantCourseWork, allSubmissionsByWorkId, allStudents) {
  Logger.log('Collecting engagement data...');

  const engagementStats = {
    studentInteractions: {}
  };

  try {
    // Process each student
    for (const student of allStudents) {
      const studentId = student.userId;
      const studentProfile = student.profile;
      const studentName = studentProfile.name.fullName;

      const studentInteraction = {
        name: studentName,
        submissionCount: 0,
        commentCount: 0 // Note: API for student comments on submissions is limited/complex
      };

      // Iterate through relevant coursework (already date-filtered)
      for (const work of relevantCourseWork) {
        if (shouldCancelDownload) {
          throw new Error("Operation was cancelled");
        }

        const submissionsForWork = allSubmissionsByWorkId[work.id] || [];
        const studentSubmission = submissionsForWork.find(s => s.userId === studentId);

        if (studentSubmission && (studentSubmission.state === 'TURNED_IN' || studentSubmission.state === 'RETURNED')) {
          studentInteraction.submissionCount++;
          
          // --- Attempting to count student comments (May be unreliable) ---
          // Classroom API doesn't easily exposes *student* comments on *submissions* directly.
          // We might need Drive API access or iterate through submission history, which is complex.
          // For now, we'll keep commentCount at 0 or log a warning.
          // Logger.log(`Note: Counting student comments on submissions for ${studentName} is currently limited.`);
          // --- End Comment Counting Section ---
        }
      }
      engagementStats.studentInteractions[studentId] = studentInteraction;
    }

    Logger.log('Engagement data collection attempted');
  } catch (error) {
    Logger.log('Error collecting engagement data: ' + error.toString());
    // Non-critical error, keep engagementStats potentially partial
  }

  return engagementStats;
}

/**
 * Calculates the average submission time for each student and identifies the earliest/latest submitters within specific windows.
 * @param {Array<object>} allStudents - List of all students.
 * @param {Array<object>} relevantCourseWork - Filtered list of coursework.
 * @param {object} allSubmissionsByWorkId - Map of submissions by course work ID.
 * @return {{earlyBird: object|null, nightOwl: object|null}} Object containing info on the student with the earliest average time within the morning window (5am-10am) 
 *                                                        and the latest average time within the night window (8pm-5am).
 */
function analyzeAverageSubmissionTimes(allStudents, relevantCourseWork, allSubmissionsByWorkId) {
  Logger.log('Analyzing average submission times specific to morning/night windows...');
  const studentWindowStats = {}; // { studentId: { name: '...', morningMinutes: 0, morningCount: 0, nightMinutes: 0, nightCount: 0, avgMorningTime: null, avgNightTime: null } }

  // 1. Calculate window-specific sum of minutes and counts
  for (const student of allStudents) {
    const studentId = student.userId;
    const studentProfile = student.profile;
    const studentName = studentProfile && studentProfile.name ? studentProfile.name.fullName : `Student ${studentId}`;

    let morningMinutes = 0;
    let morningCount = 0;
    let nightMinutes = 0;
    let nightCount = 0;

    for (const work of relevantCourseWork) {
      if (shouldCancelDownload) throw new Error("Operation was cancelled during window average time analysis.");

      const submissionsForWork = allSubmissionsByWorkId[work.id] || [];
      const studentSubmission = submissionsForWork.find(s => s.userId === studentId);

      if (studentSubmission && (studentSubmission.state === 'TURNED_IN' || studentSubmission.state === 'RETURNED')) {
        const submissionDate = getSubmissionTimestamp(studentSubmission);
        if (submissionDate) {
          const submissionHour = submissionDate.getHours();
          const submissionMinutes = submissionHour * 60 + submissionDate.getMinutes();

          // Check if submission falls in morning window (5am <= time < 10am)
          if (submissionMinutes >= 300 && submissionMinutes < 600) {
            morningMinutes += submissionMinutes;
            morningCount++;
          }
          // Check if submission falls in night window (8pm <= time < 5am)
          if (submissionMinutes >= 1200 || submissionMinutes < 300) {
             nightMinutes += submissionMinutes;
             nightCount++;
          }
        }
      }
    }

    // Calculate averages only if submissions exist in the respective windows
    const avgMorningTime = morningCount > 0 ? morningMinutes / morningCount : null;
    const avgNightTime = nightCount > 0 ? nightMinutes / nightCount : null;

    studentWindowStats[studentId] = {
      name: studentName,
      avgMorningTime: avgMorningTime,
      avgNightTime: avgNightTime
    };
  }

  // 2. Find Early Bird: Earliest average morning window time
  let earlyBird = null;
  let minAvgMorningWindowTime = Infinity;

  for (const studentId in studentWindowStats) {
    const data = studentWindowStats[studentId];
    if (data.avgMorningTime !== null) { // Check if they had morning submissions
      if (data.avgMorningTime < minAvgMorningWindowTime) {
        minAvgMorningWindowTime = data.avgMorningTime;
        earlyBird = {
          name: data.name,
          timeMinutes: data.avgMorningTime // Use the morning window average
        };
      }
    }
  }

  // 3. Find Night Owl: Latest average night window time (mapped)
  let nightOwl = null;
  let maxMappedNightWindowTime = -1;
  const dayStartOffset = 300; // 5:00 am in minutes
  const minutesInDay = 1440; // 24 * 60

  for (const studentId in studentWindowStats) {
    const data = studentWindowStats[studentId];
    if (data.avgNightTime !== null) { // Check if they had night submissions
       const avgTime = data.avgNightTime;
       // Map time relative to 5am start to handle wrap-around comparison correctly
       const mappedTime = (avgTime - dayStartOffset + minutesInDay) % minutesInDay;
       
       if (mappedTime > maxMappedNightWindowTime) {
         maxMappedNightWindowTime = mappedTime;
         nightOwl = {
           name: data.name,
           timeMinutes: avgTime // Use the night window average
         };
       }
    }
  }

  // Helper to format minutes into HH:MM
  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  Logger.log(`Window-specific average time analysis complete. Early bird (avg morning time): ${earlyBird ? earlyBird.name : 'N/A'} (${formatTime(earlyBird?.timeMinutes)}). Night owl (avg night time): ${nightOwl ? nightOwl.name : 'N/A'} (${formatTime(nightOwl?.timeMinutes)})`);

  return {
    earlyBird: earlyBird ? { name: earlyBird.name, time: formatTime(earlyBird.timeMinutes) } : null,
    nightOwl: nightOwl ? { name: nightOwl.name, time: formatTime(nightOwl.timeMinutes) } : null,
  };
}

/**
 * Analyzes assignment creation dates using pre-fetched data
 * @param {Array<object>} relevantCourseWork - The list of coursework objects already filtered by date
 * @return {object} An object containing assignment creation stats by month (with/without deadline)
 */
function analyzeAssignmentCreation(relevantCourseWork) {
  Logger.log('Analyzing assignment creation dates...');

  const assignmentStats = {
    totalAssignments: 0,
    totalWithDeadline: 0,
    totalWithoutDeadline: 0,
    withDeadlineByMonth: {},
    withoutDeadlineByMonth: {}
  };

  for (const work of relevantCourseWork) {
     if (shouldCancelDownload) {
      throw new Error("Operation was cancelled during assignment creation analysis.");
    }
    
    const creationDate = work.creationTime ? new Date(work.creationTime) : null;
    if (!creationDate) continue; // Skip if no creation date

    assignmentStats.totalAssignments++; // Increment total count

    const month = `${creationDate.getFullYear()}-${String(creationDate.getMonth() + 1).padStart(2, '0')}`;

    if (work.dueDate) {
      assignmentStats.totalWithDeadline++; // Increment deadline count
      assignmentStats.withDeadlineByMonth[month] = (assignmentStats.withDeadlineByMonth[month] || 0) + 1;
    } else {
      assignmentStats.totalWithoutDeadline++; // Increment no-deadline count
      assignmentStats.withoutDeadlineByMonth[month] = (assignmentStats.withoutDeadlineByMonth[month] || 0) + 1;
    }
  }

  Logger.log('Assignment creation dates analyzed.');
  return assignmentStats;
}

/**
 * Main analysis function for Classroom Wrapped
 * @param {string} courseId - The ID of the course to analyze
 * @param {string|null} startDateStr - Optional start date as string (YYYY-MM-DD)
 * @param {string|null} endDateStr - Optional end date as string (YYYY-MM-DD)
 * @param {boolean} countSlides - Whether to count slides in presentations
 * @return {object} The analysis results object
 */
function franklinWrappedAnalysis(courseId, startDateStr, endDateStr, countSlides) {
  try {
    Logger.log(`Starting analysis for course ${courseId}`);
    
    // Reset cancel flag
    shouldCancelDownload = false;
    
    // Parse dates if provided
    let startDate = null;
    let endDate = null;
    
    if (startDateStr && endDateStr) {
      try {
        startDate = new Date(startDateStr);
        endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59); // Set to end of day
        
        Logger.log(`Using date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      } catch (dateParseError) {
        Logger.log(`Error parsing dates: ${dateParseError}. Using entire course history.`);
        // Continue with null dates (entire history)
      }
    } else {
      Logger.log("No date range specified. Using entire course history.");
    }
    
    // Get basic course info
    const courseDetails = Classroom.Courses.get(courseId);
    Logger.log(`Analyzing course: ${courseDetails.name} (${courseDetails.id})`);
    
    // Structure for results
    const results = {
      courseId: courseId,
      courseDetails: courseDetails,
      timestamp: new Date().toISOString(),
      data: {}
    };
    
    // Get all students, course work, and materials
    Logger.log("Fetching course data (students, course work, materials)...");
    
    const allStudents = getAllStudents(courseId);
    Logger.log(`Found ${allStudents.length} students in course`);
    
    const allCourseWork = getAllCourseWork(courseId);
    Logger.log(`Found ${allCourseWork.length} coursework items in course`);
    
    // Filter course work and fetch submissions based on date range
    const filteredData = filterAndFetchSubmissions(courseId, allCourseWork, startDate, endDate);
    Logger.log(`Filtered to ${filteredData.relevantCourseWork.length} coursework items in date range`);
    
    // Analyze submissions
    Logger.log("Analyzing submission data...");
    const submissionStats = analyzeSubmissions(
      filteredData.relevantCourseWork, 
      filteredData.allSubmissionsByWorkId,
      allStudents.length
    );
    
    // Analyze student engagement
    Logger.log("Analyzing student engagement...");
    const engagementStats = collectEngagementData(
      filteredData.relevantCourseWork,
      filteredData.allSubmissionsByWorkId,
      allStudents
    );
    
    // Analyze time patterns
    Logger.log("Analyzing submission time patterns...");
    const timePatterns = analyzeAverageSubmissionTimes(
      allStudents,
      filteredData.relevantCourseWork,
      filteredData.allSubmissionsByWorkId
    );
    
    // Analyze course materials
    Logger.log("Analyzing course materials...");
    const allMaterials = getAllMaterials(courseId);
    Logger.log(`Found ${allMaterials.length} announcements with materials`);
    
    const materialStats = analyzeMaterialsDetailed(
      filteredData.relevantCourseWork,
      allMaterials,
      startDate,
      endDate,
      countSlides
    );
    
    // Analyze assignment patterns
    Logger.log("Analyzing assignment creation patterns...");
    const assignmentStats = analyzeAssignmentCreation(filteredData.relevantCourseWork);
    
    // Combine all results
    results.data = {
      submissionStats: submissionStats,
      engagementStats: engagementStats,
      timePatterns: timePatterns,
      materialStats: materialStats,
      assignmentStats: assignmentStats
    };
    
    Logger.log("Analysis completed successfully");
    return results;
    
  } catch (error) {
    // Log the full error details to the server logs
    Logger.log("ERROR in franklinWrappedAnalysis: " + error.toString());
    if (error.stack) {
      Logger.log("Stack trace: " + error.stack);
    }
    
    // Return a structured error object that can be handled by the client
    return {
      error: {
        message: "Analysis failed: " + error.message,
        cancelled: shouldCancelDownload,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Helper function to count words in a text
 */
function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Helper function to simplify MIME types to readable categories
 */
function simplifyMimeType(mimeType) {
  if (!mimeType) return 'unknown';
  
  if (mimeType.includes('spreadsheet')) return 'spreadsheet';
  if (mimeType.includes('document')) return 'document';
  if (mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('audio')) return 'audio';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive';
  
  return 'other';
}

/**
 * Helper function to get a reliable submission timestamp
 * Tries `updateTime` first, then falls back to `creationTime`
 */
function getSubmissionTimestamp(submission) {
  if (!submission) return null;

  const timestampStr = submission.updateTime || submission.creationTime;
  if (!timestampStr) return null;

  try {
    return new Date(timestampStr);
  } catch (e) {
    Logger.log(`Could not parse timestamp: ${timestampStr}`);
    return null;
  }
}

/**
 * Diagnostic function to get details about a specific file
 * Useful for troubleshooting Drive API or Slides API issues
 * @param {string} fileId - The ID of the file to check
 * @return {object} Details about the file
 */
function getDiagnosticFileInfo(fileId) {
  const diagnosticData = {
    fileId: fileId,
    driveInfo: null,
    isSlides: false,
    slidesInfo: null,
    error: null
  };
  
  try {
    // Try to get file metadata using Drive API v3
    const fileMetadata = Drive.Files.get(fileId, {
      fields: 'id,name,mimeType,webViewLink,capabilities,trashed'
    });
    
    diagnosticData.driveInfo = fileMetadata;
    diagnosticData.isSlides = fileMetadata.mimeType === 'application/vnd.google-apps.presentation';
    
    // If it's a presentation, try to get slide count
    if (diagnosticData.isSlides) {
      try {
        const presentation = Slides.Presentations.get(fileId);
        diagnosticData.slidesInfo = {
          slideCount: presentation.slides ? presentation.slides.length : 0,
          title: presentation.title
        };
      } catch (slidesError) {
        diagnosticData.error = `Slides API error: ${slidesError.toString()}`;
      }
    }
    
    return diagnosticData;
  } catch (e) {
    diagnosticData.error = `Drive API error: ${e.toString()}`;
    return diagnosticData;
  }
} 