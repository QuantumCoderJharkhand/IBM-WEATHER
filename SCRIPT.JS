document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const locationInput = document.getElementById('locationInput');
    const clearBtn = document.getElementById('clearBtn');
    const geoBtn = document.getElementById('geoBtn');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const locationTabs = document.getElementById('locationTabs');
    const weatherDisplay = document.getElementById('weather-display');
    const welcomeMessage = document.getElementById('welcome-message');
    const currentWeatherDiv = document.getElementById('current-weather');
    const forecastContainer = document.getElementById('forecast-container');
    const loader = document.getElementById('loader');
    const themeToggle = document.getElementById('themeToggle');
    const unitToggle = document.getElementById('unitToggle');

    // --- API Configuration ---
    const apiKey = '7f6c17820f5a2ff85028942f3153d3a5'; // Your OpenWeatherMap API key
    const apiBaseUrl = 'https://api.openweathermap.org/data/2.5';

    // --- Application State ---
    let savedLocations = [];
    let activeLocation = null;
    let currentUnit = 'metric';
    let currentTheme = 'light';

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => { func.apply(this, args); }, delay);
        };
    };

    // --- EVENT LISTENERS ---
    locationInput.addEventListener('input', (e) => debouncedCitySearch(e.target.value));
    locationInput.addEventListener('input', () => clearBtn.classList.toggle('hidden', !locationInput.value));
    clearBtn.addEventListener('click', () => {
        locationInput.value = '';
        clearBtn.classList.add('hidden');
        autocompleteResults.innerHTML = '';
    });
    geoBtn.addEventListener('click', handleGeolocation);
    themeToggle.addEventListener('change', toggleTheme);
    unitToggle.addEventListener('change', toggleUnits);

    function initializeApp() {
        loadSettings();
        loadLocations();
        renderTabs();
        if (savedLocations.length > 0) {
            setActiveLocation(savedLocations[0].id);
        } else {
            welcomeMessage.classList.remove('hidden');
        }
    }
    initializeApp();

    // --- SETTINGS & LOCAL STORAGE ---
    function loadSettings() {
        currentTheme = localStorage.getItem('weatherTheme') || 'light';
        document.body.className = currentTheme === 'dark' ? 'dark-mode' : '';
        themeToggle.checked = currentTheme === 'dark';
        currentUnit = localStorage.getItem('weatherUnit') || 'metric';
        unitToggle.checked = currentUnit === 'imperial';
    }

    function saveSettings() {
        localStorage.setItem('weatherTheme', currentTheme);
        localStorage.setItem('weatherUnit', currentUnit);
    }

    function loadLocations() {
        const stored = localStorage.getItem('weatherLocations');
        if (stored) savedLocations = JSON.parse(stored);
    }

    function saveLocations() {
        localStorage.setItem('weatherLocations', JSON.stringify(savedLocations));
    }

    // --- FEATURE LOGIC ---
    function toggleTheme() {
        currentTheme = themeToggle.checked ? 'dark' : 'light';
        document.body.classList.toggle('dark-mode', themeToggle.checked);
        saveSettings();
    }

    function toggleUnits() {
        currentUnit = unitToggle.checked ? 'imperial' : 'metric';
        if (activeLocation) {
            setActiveLocation(activeLocation.id); // Re-fetch with new units
        }
        saveSettings();
    }

    function handleGeolocation() {
        if (navigator.geolocation) {
            const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    const geoResponse = await fetch(`https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${apiKey}`);
                    const geoData = await geoResponse.json();
                    if (geoData.length > 0) {
                        const city = geoData[0];
                        const locationData = { id: city.lat + '' + city.lon, name: city.name, lat: city.lat, lon: city.lon, country: city.country, accuracy: accuracy };
                        addLocationAndFetch(locationData);
                    }
                },
                (error) => { alert('Unable to retrieve your location.'); console.error(error); },
                options
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    }

    // --- LOCATION & STATE MANAGEMENT ---
    function addLocationAndFetch(locationData) {
        if (!savedLocations.some(loc => loc.id === locationData.id)) {
            savedLocations.push(locationData);
            saveLocations();
        }
        setActiveLocation(locationData.id, true);
    }

    function removeLocation(locationId) {
        savedLocations = savedLocations.filter(loc => loc.id !== locationId);
        saveLocations();
        renderTabs();
        if (savedLocations.length > 0) {
            setActiveLocation(savedLocations[0].id);
        } else {
            activeLocation = null;
            weatherDisplay.classList.add('hidden');
            welcomeMessage.classList.remove('hidden');
        }
    }

    function setActiveLocation(locationId, isNew = false) {
        activeLocation = savedLocations.find(loc => loc.id === locationId);
        if (!activeLocation) return;
        if (isNew) {
            renderTabs();
        }
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-id='${locationId}']`)?.classList.add('active');
        fetchWeather(activeLocation);
    }

    // --- UI RENDERING ---
    function renderTabs() {
        locationTabs.innerHTML = '';
        if (savedLocations.length === 0) {
            locationTabs.innerHTML = '<li class="tab-placeholder">Add a city to see it here</li>';
            return;
        }
        savedLocations.forEach(loc => {
            const tab = document.createElement('li');
            tab.className = `tab ${activeLocation && loc.id === activeLocation.id ? 'active' : ''}`;
            tab.dataset.id = loc.id;
            tab.textContent = loc.name;
            tab.addEventListener('click', () => setActiveLocation(loc.id));
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeLocation(loc.id); });
            tab.appendChild(removeBtn);
            locationTabs.appendChild(tab);
        });
    }

    // --- API & DATA FETCHING ---
    async function handleCitySearch(query) {
        const trimmedQuery = query.trim();
        if (trimmedQuery.length < 3) {
            autocompleteResults.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${trimmedQuery}&limit=5&appid=${apiKey}`);
            if (!response.ok) throw new Error('City lookup failed.');
            displaySuggestions(await response.json());
        } catch (error) {
            console.error("Error fetching city suggestions:", error);
            autocompleteResults.innerHTML = '';
        }
    }
    const debouncedCitySearch = debounce(handleCitySearch, 500);

    function displaySuggestions(suggestions) {
        autocompleteResults.innerHTML = '';
        suggestions.forEach(city => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `${city.name}, <small>${city.state || ''} ${city.country}</small>`;
            item.addEventListener('click', () => {
                const newLocation = { id: city.lat + '' + city.lon, name: city.name, lat: city.lat, lon: city.lon, country: city.country };
                addLocationAndFetch(newLocation);
                locationInput.value = '';
                autocompleteResults.innerHTML = '';
            });
            autocompleteResults.appendChild(item);
        });
    }

    async function fetchWeather(location) {
        loader.style.display = 'block';
        weatherDisplay.classList.add('hidden');
        welcomeMessage.classList.add('hidden');

        const { lat, lon, name, country, accuracy } = location;
        const weatherURL = `${apiBaseUrl}/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${currentUnit}`;
        const forecastURL = `${apiBaseUrl}/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${currentUnit}`;

        try {
            const [currentRes, forecastRes] = await Promise.all([fetch(weatherURL), fetch(forecastURL)]);

            if (!currentRes.ok || !forecastRes.ok) {
                // Throw an error with the status to handle it below
                throw new Error(`API Error: Status ${currentRes.status} & ${forecastRes.status}`);
            }

            displayCurrentWeather(await currentRes.json(), name, country, accuracy); // Pass the chosen name
            displayForecast(await forecastRes.json());

            weatherDisplay.classList.remove('hidden');
        } catch (error) {
            console.error("Fetch Weather Error:", error);
            welcomeMessage.textContent = 'Could not fetch weather data. Please try again.';
            welcomeMessage.classList.remove('hidden');
        } finally {
            loader.style.display = 'none';
        }
    }

    function displayCurrentWeather(data, chosenName, chosenCountry, accuracy) {
        // Find all elements to update
        const header = currentWeatherDiv.querySelector('h2') || document.createElement('h2');
        const temp = currentWeatherDiv.querySelector('.temperature') || document.createElement('div');
        const condition = currentWeatherDiv.querySelector('.condition') || document.createElement('div');
        const mainDetails = document.getElementById('main-details');
        const accuracyDetails = document.getElementById('accuracy-details');

        // Prioritize the user's chosen name, but use API country for consistency
        header.textContent = `${chosenName}, ${chosenCountry || data.sys.country}`;

        temp.className = 'temperature';
        temp.textContent = `${Math.round(data.main.temp)}°${currentUnit === 'metric' ? 'C' : 'F'}`;

        condition.className = 'condition';
        condition.innerHTML = `<img src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" alt="${data.weather[0].description}"><span>${data.weather[0].main}</span>`;

        mainDetails.textContent = `Feels like: ${Math.round(data.main.feels_like)}°${currentUnit === 'metric' ? 'C' : 'F'} | Wind: ${data.wind.speed} ${currentUnit === 'metric' ? 'm/s' : 'mph'} | Humidity: ${data.main.humidity}%`;

        accuracyDetails.textContent = accuracy ? `Location accuracy: within ${Math.round(accuracy)} meters.` : '';

        // Ensure all parts are in the DOM
        if (!currentWeatherDiv.contains(header)) currentWeatherDiv.prepend(header);
        if (!currentWeatherDiv.contains(temp)) header.after(temp);
        if (!currentWeatherDiv.contains(condition)) temp.after(condition);
    }

    function displayForecast(data) {
        forecastContainer.innerHTML = '';
        const dailyForecasts = data.list.filter(item => item.dt_txt.includes("12:00:00"));
        dailyForecasts.forEach(day => {
            const date = new Date(day.dt * 1000);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            forecastContainer.innerHTML += `
                <div class="forecast-card">
                    <div class="day">${dayName}</div>
                    <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png" alt="${day.weather[0].description}">
                    <div class="temp">${Math.round(day.main.temp_max)}° / ${Math.round(day.main.temp_min)}°</div>
                </div>
            `;
        });
    }
});