document.addEventListener('DOMContentLoaded', () => {
    // ** IMPORTANT: Replace with your actual Firebase project config **
    const firebaseConfig = {
      apiKey: "AIzaSyC4YfTWe9eLhPZs4LBTErkLW-boINPwfAY",
      authDomain: "booking-fe2ea.firebaseapp.com",
      projectId: "booking-fe2ea",
      storageBucket: "booking-fe2ea.firebasestorage.app",
      messagingSenderId: "532325286601",
      appId: "1:532325286601:web:4fc3c64c70cf70c60c8318",
      measurementId: "G-VJ6KKNZZ82"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    const bookedTimesList = document.getElementById('booked-times-list');
    const modal = document.getElementById('booking-modal');
    const modalTimeSlot = document.getElementById('modal-time-slot');
    const bookingForm = document.getElementById('booking-form');
    const closeBtn = document.querySelector('.close-btn');
    const bookCustomBtn = document.getElementById('book-custom-btn');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');

    const bookingsCollection = db.collection('bookings');

    // Initialize Flatpickr for a modern time picker UI
    flatpickr(startTimeInput, {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 5,
        defaultDate: new Date()
    });
    flatpickr(endTimeInput, {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 5,
        defaultDate: new Date()
    });

    // --- Helper function to get today's date in YYYY-MM-DD format ---
    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- Helper function to get current time in HH:MM format ---
    const getCurrentTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    // --- Helper function to check if a booking is in the past ---
    const isBookingDone = (endTime) => {
        const now = getCurrentTime();
        return endTime <= now;
    };

    // --- Helper function to convert time to minutes ---
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    // --- Render Booked Times ---
    const renderBookedTimes = (bookings) => {
        bookedTimesList.innerHTML = '';
        if (bookings.length === 0) {
            bookedTimesList.textContent = "No bookings for today. All clear!";
            bookedTimesList.style.textAlign = 'center';
            return;
        }
        
        bookings.sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        bookings.forEach(booking => {
            const bookedSlot = document.createElement('div');
            bookedSlot.classList.add('booked-slot');
            
            // Check if the booking is "Done" and apply a class
            if (isBookingDone(booking.endTime)) {
                bookedSlot.classList.add('done');
            }
            
            bookedSlot.innerHTML = `
                <div>
                    <strong>${booking.startTime} - ${booking.endTime}</strong>
                    <span>${booking.name} - ${booking.project}</span>
                </div>
                ${isBookingDone(booking.endTime) ? '<span>&#10003; Done</span>' : ''}
            `;
            bookedTimesList.appendChild(bookedSlot);
        });
    };
    
    // --- Check for Time Overlaps ---
    const checkOverlap = (bookings, newStart, newEnd) => {
        const newStartMinutes = timeToMinutes(newStart);
        const newEndMinutes = timeToMinutes(newEnd);
        
        return bookings.some(booking => {
            const existingStartMinutes = timeToMinutes(booking.startTime);
            const existingEndMinutes = timeToMinutes(booking.endTime);
            
            return (newStartMinutes < existingEndMinutes) && (newEndMinutes > existingStartMinutes);
        });
    };
    
    // --- Real-time Firestore Listener (with filter) ---
    const todayDate = getTodayDate();
    bookingsCollection.where('date', '==', todayDate).onSnapshot(querySnapshot => {
        const bookings = [];
        querySnapshot.forEach(doc => {
            bookings.push(doc.data());
        });
        renderBookedTimes(bookings);
    }, error => {
        console.error("Error fetching documents: ", error);
        bookedTimesList.textContent = "Failed to connect to the database.";
    });
    
    // --- Handle Custom Time Booking Button Click ---
    bookCustomBtn.addEventListener('click', async () => {
        const customStartTime = startTimeInput.value;
        const customEndTime = endTimeInput.value;
        const currentTime = getCurrentTime();

        if (!customStartTime || !customEndTime) {
            alert('Please select both a start and end time.');
            return;
        }
        
        if (customStartTime >= customEndTime) {
            alert('End time must be after start time.');
            return;
        }

        // Prevent booking a time that has already passed
        if (customStartTime < currentTime) {
            alert('You cannot book a meeting in the past.');
            return;
        }

        const snapshot = await bookingsCollection.where('date', '==', todayDate).get();
        const currentBookings = snapshot.docs.map(doc => doc.data());

        if (checkOverlap(currentBookings, customStartTime, customEndTime)) {
            alert('This time range overlaps with an existing booking. Please choose another time.');
            return;
        }

        modalTimeSlot.textContent = `Time: ${customStartTime} - ${customEndTime}`;
        modal.style.display = 'flex';
        bookingForm.dataset.startTime = customStartTime;
        bookingForm.dataset.endTime = customEndTime;
    });

    // --- Handle Booking Confirmation from Modal ---
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const project = document.getElementById('project').value;
        const startTime = bookingForm.dataset.startTime;
        const endTime = bookingForm.dataset.endTime;
        const bookingDate = getTodayDate();

        try {
            await bookingsCollection.add({
                name: name,
                project: project,
                startTime: startTime,
                endTime: endTime,
                date: bookingDate, // Store the booking date
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Booking confirmed!');
            modal.style.display = 'none';
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to book the slot. Please try again.");
        }
    });

    // --- Modal Control ---
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // --- QR Code Generation ---
    const generateQRCode = () => {
        const pageURL = window.location.href;
        if (pageURL && QRCode) {
            new QRCode(document.getElementById("qrcode"), {
                text: pageURL,
                width: 128,
                height: 128,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    };
    
    generateQRCode();
    flatpickr(startTimeInput, {
  enableTime: true,
  noCalendar: true,
  dateFormat: "H:i",
  time_24hr: true,
  minuteIncrement: 5,
  defaultDate: new Date(),
  disableMobile: true // This is the key line
});

flatpickr(endTimeInput, {
  enableTime: true,
  noCalendar: true,
  dateFormat: "H:i",
  time_24hr: true,
  minuteIncrement: 5,
  defaultDate: new Date(),
  disableMobile: true // And this one
});
});

