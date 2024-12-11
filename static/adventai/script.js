document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email-input');
  const submitButton = document.getElementById('submit-button');
  const emailForm = document.getElementById('email-form');
  const countdownText = document.getElementById('countdown-text');
  const christmasBg = document.querySelector('.christmas-background');

  const NUM_SNOWFLAKES = 50;
  const NUM_CANDYCANES = 20;

  function validateEmail(email) {
      const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return re.test(String(email).toLowerCase());
  }

  function createFallingItems(num, emoji, rotate = false) {
      for (let i = 0; i < num; i++) {
          const item = document.createElement('div');
          item.textContent = emoji;
          item.classList.add(rotate ? 'candycane' : 'snowflake');
          
          const left = Math.random() * 100;
          const animationDuration = 5 + Math.random() * 10;
          const delay = Math.random() * 5;

          item.style.top = '-40px';
          item.style.left = `${left}%`;
          item.style.animationDuration = `${animationDuration}s`;
          item.style.animationDelay = `${delay}s`;
          
          if (rotate) {
              item.style.transform = 'rotate(45deg)';
          }

          christmasBg.appendChild(item);
      }
  }

  // Create falling items
  createFallingItems(NUM_SNOWFLAKES, '❄️');
  createFallingItems(NUM_CANDYCANES, '🎁', true);

  // Email validation
  emailInput.addEventListener('input', (e) => {
      const isValid = validateEmail(e.target.value);
      submitButton.disabled = !isValid;
  });

  // Form submission
  emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value;

      if (validateEmail(email)) {
          try {
              const url = new URL('https://hooks.zapier.com/hooks/catch/19666829/2izmzdp/');
              url.searchParams.set('email', email);
              
              await fetch(url);
              
              localStorage.setItem('subscribed', 'true');
              updateUI();
          } catch (error) {
              console.error('Could not subscribe user:', error);
          }
      }
  });

  // Countdown logic
  function updateCountdown() {
      const startDate = new Date('2024-12-13 00:00:00').getTime();
      const now = new Date().getTime();
      const daysToGo = Math.floor((startDate - now) / 1000 / 24 / 60 / 60);
      const isSubscribed = localStorage.getItem('subscribed') === 'true';

      let countdownMessage = '';
      if (daysToGo > 0) {
          countdownMessage += `${daysToGo} ${daysToGo === 1 ? 'day' : 'days'} to go!`;
      } else {
          countdownMessage += 'Unwrap today\'s app!';
      }

      if (!isSubscribed) {
          countdownMessage += ' Sign up to get notified when it\'s time to unwrap your apps.';
      }

      countdownText.textContent = countdownMessage;
  }

  function updateUI() {
      const isSubscribed = localStorage.getItem('subscribed') === 'true';
      const emailSection = document.getElementById('email-section');
      const subscribedMessage = document.createElement('p');
      
      if (isSubscribed) {
          subscribedMessage.textContent = 'Check your inbox! You will receive a new AI gift every day. 🎉';
          emailSection.innerHTML = '';
          emailSection.appendChild(subscribedMessage);
      }
  }

  // Initial UI update
  updateCountdown();
  updateUI();
  setInterval(updateCountdown, 86400000); // Update daily
});