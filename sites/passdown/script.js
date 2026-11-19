const walkthroughs = {
  sell: [
    ['THE LISTING', 'Give it a little spotlight.', 'Add a photo, describe the condition, and name your price. You can mark it free or add a pick-up-by date for move-out.'],
    ['THE OFFER', 'Find its next person.', 'Review offers and accept one. The item is then reserved for that buyer, so you can focus on arranging the handoff.'],
    ['THE HANDOFF', 'Meet. Pass it on. Done.', 'Use the deal’s messages to agree on a pickup place and time. Meet in person, collect payment, then mark it sold.'],
  ],
  buy: [
    ['THE FIND', 'Find your room’s missing piece.', 'Browse listings by school or category, or search for something specific. Check the photos, condition, price, and pickup deadline.'],
    ['THE OFFER', 'Make it an offer.', 'Sign in with Google and offer the asking price or less. Once the seller accepts your offer, the item is reserved for you.'],
    ['THE HANDOFF', 'Give it a new home.', 'Message the seller and confirm a pickup place and time. Meet in public, check the item, and pay the seller in person.'],
  ],
};

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((choice) => {
      const active = choice === button;
      choice.classList.toggle('is-active', active);
      choice.setAttribute('aria-pressed', String(active));
    });
    walkthroughs[button.dataset.mode].forEach(([label, title, text], index) => {
      const step = index + 1;
      document.getElementById(`step-label-${step}`).textContent = label;
      document.getElementById(`step-title-${step}`).textContent = title;
      document.getElementById(`step-text-${step}`).textContent = text;
    });
  });
});
