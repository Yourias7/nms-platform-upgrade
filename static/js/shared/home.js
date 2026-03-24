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

  // 2) Launch button navigates to the correct platform entry page
  launchBtn.addEventListener('click', function () {
    if (!selectedOption) return;

    // Optional: keep it in session storage (useful later)
    sessionStorage.setItem('selectedPlatform', selectedOption);

    // Default: keep 4skelion working as it already is
    let destination = '/4skelion/liveview';

    // ✅ NEW: 3skelion now goes to its own liveview
    if (selectedOption === '3skelion') {
      destination = '/3skelion/liveview';
    }

    // Everything else still “Coming Soon” for now
    if (selectedOption === 'f-steering' || selectedOption === 'f-qual') {
      destination = '/coming_soon';
    }

    window.location.href = destination;
  });
});