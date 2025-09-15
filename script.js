document.addEventListener('DOMContentLoaded', () => {
    // ** Your Actual Firebase Configuration **
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
            bookedSlot.innerHTML = `
                <strong>${booking.startTime} - ${booking.endTime}</strong>
                <span>${booking.name} - ${booking.project}</span>
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
    
    // --- Real-time Firestore Listener ---
    bookingsCollection.onSnapshot(querySnapshot => {
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

        if (!customStartTime || !customEndTime) {
            alert('Please select both a start and end time.');
            return;
        }

        if (customStartTime >= customEndTime) {
            alert('End time must be after start time.');
            return;
        }

        const snapshot = await bookingsCollection.get();
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

        try {
            await bookingsCollection.add({
                name: name,
                project: project,
                startTime: startTime,
                endTime: endTime,
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
});
