document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/listings')
      .then(response => response.json())
      .then(data => {
        const listingsContainer = document.getElementById('listings');
        data.listings.forEach(listing => {
          const listingElement = document.createElement('div');
          listingElement.className = 'listing';
          listingElement.innerHTML = `
            <h2>${listing.title}</h2>
            <p>${listing.description}</p>
            <p>Starting Bid: $${listing.starting_bid}</p>
            ${listing.image_url ? `<img src="${listing.image_url}" alt="${listing.title}">` : ''}
          `;
          listingsContainer.appendChild(listingElement);
        });
      })
      .catch(error => console.error('Error fetching listings:', error));
  });