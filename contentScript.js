// contentScript.js
// This script will run on YouTube playlist pages

// Function to calculate total duration
function calculateTotalDuration() {
    let videoDurations = document.querySelectorAll('span.ytd-thumbnail-overlay-time-status-renderer');
    let totalDurationSeconds = 0;
  
    videoDurations.forEach((duration, idx) => {
      let durationText = duration.textContent.trim();
      console.log(idx, " : ", durationText)
      let [minutes, seconds] = durationText.split(':').map(Number);
      totalDurationSeconds += minutes * 60 + seconds;
    });
  
    return totalDurationSeconds;
  }

  // Function to calculate total duration when video durations are available
function calculateTotalDurationWhenAvailable() {
    let videoDurations = document.querySelectorAll('.ytd-thumbnail-overlay-time-status-renderer');
    console.log({videoDurations})
    
    if (videoDurations.length > 0) {
      // Video durations are available, calculate total duration
      let totalDuration = calculateTotalDuration();
      console.log('Total duration(items not found):', totalDuration);
    } else {
      // If video durations are not available, observe DOM changes
      let observer = new MutationObserver((mutationsList, observer) => {
        for(let mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.target.classList.contains('ytd-thumbnail-overlay-time-status-renderer')) {
              console.log({mutation})
            // Video durations are now available, calculate total duration
            let totalDuration = calculateTotalDuration();
            console.log('Total duration(items found):', totalDuration);
            observer.disconnect(); // Disconnect observer once the calculation is done
            break;
          }
        }
      });
  
      // Start observing changes in the DOM
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  
  // Display total duration on the page
  function displayTotalDuration(totalDurationSeconds) {
    let playlistHeader = document.querySelector('.metadata-buttons-wrapper .style-scope .ytd-playlist-header-renderer');
    if (playlistHeader) {
      let durationText = `${Math.floor(totalDurationSeconds / 60)} minutes ${totalDurationSeconds % 60} seconds`;
      let totalDurationElement = document.createElement('span');
      totalDurationElement.textContent = `Total Duration: ${durationText}`;
      playlistHeader.appendChild(totalDurationElement);
    }
  }
  
  // Calculate total duration and display it
//   let totalDuration = calculateTotalDuration();
  // Call the function to calculate total duration when the content is available
  calculateTotalDurationWhenAvailable();
//   displayTotalDuration(totalDuration);
  