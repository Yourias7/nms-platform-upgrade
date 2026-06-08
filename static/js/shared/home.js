// Home page selection and launch logic
let selectedOption = null;

document.addEventListener('DOMContentLoaded', function () {
  const featureCards = document.querySelectorAll('.feature-card');
  const launchBtn = document.getElementById('launchBtn');

  // 1) Selecting a card just stores which platform we want to open
  featureCards.forEach(card => {
    card.addEventListener('click', function () {
      featureCards.forEach(c => c.classList.remove('selected'));
      this.classList.add('selected');

      selectedOption = this.dataset.option;
      launchBtn.disabled = false;
    });
  });

  // Handle launch button click
  launchBtn.addEventListener('click', function() {
    if (selectedOption) {
      // Store the selection in sessionStorage for later use if needed
      sessionStorage.setItem('selectedPlatform', selectedOption);
      
      // Navigate based on selected option
      let destination = '/4skelion/liveview'; // Default for 4skelion

      switch (selectedOption) {
        case '4skelion':
          destination = '/4skelion/liveview';
          break;
        case 'f-steering':
          destination = '/f-steering/liveview';
          break;
        case '3skelion':
          destination = '/3skelion/liveview';
          break;
        case 'f-qual':
          destination = '/f-qual/dashboard';
          break;
        default:
          destination = '/coming_soon';
      }
      
      window.location.href = destination;
    }
  });
});