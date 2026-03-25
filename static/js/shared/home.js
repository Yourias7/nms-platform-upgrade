// Home page selection and launch logic
let selectedOption = null;

document.addEventListener('DOMContentLoaded', function() {
  const featureCards = document.querySelectorAll('.feature-card');
  const launchBtn = document.getElementById('launchBtn');

  // Handle card selection
  featureCards.forEach(card => {
    card.addEventListener('click', function() {
      // Remove selected class from all cards
      featureCards.forEach(c => c.classList.remove('selected'));
      
      // Add selected class to clicked card
      this.classList.add('selected');
      
      // Store the selected option
      selectedOption = this.dataset.option;
      
      // Enable the launch button
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
        case 'f-steering' || '3skelion':
          destination = '/coming_soon';
          break;
        case 'f-qual':
          destination = '/f-qual/liveview';
          break;
        default:
          destination = '/coming_soon';
      }
      
      window.location.href = destination;
    }
  });
});
