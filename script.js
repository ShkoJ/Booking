document.addEventListener('DOMContentLoaded', () => {
    // ** IMPORTANT: Replace with your actual Firebase project config **
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    };
    
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    const bookedTimesList = document.getElementById('booked-times-list');
    const modal = document.getElementById('booking-modal');
    const modalTimeSlot = document.getElementById('modal-time-slot');
    const bookingForm = document.getElementById('booking-form');
    const closeBtn = document.querySelector('.close-btn');
    const bookTimeBtn = document.getElementById('book-time-btn');
    const startTimeInput = document.getElementById('start-time');
    const durationSelect = document.getElementById('duration');

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
        
        // Sort bookings by start time
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
    
    // --- Handle Booking Button Click ---
    bookTimeBtn.addEventListener('click', async () => {
        const startTime = startTimeInput.value;
        const duration = parseInt(durationSelect.value, 10);

        if (!startTime) {
            alert('Please select a start time.');
            return;
        }

        const startMinutes = timeToMinutes(startTime);
        const endMinutes = startMinutes + duration;
        
        // Convert back to HH:MM format
        const endHour = Math.floor(endMinutes / 60) % 24;
        const endMinute = endMinutes % 60;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

        const snapshot = await bookingsCollection.get();
        const currentBookings = snapshot.docs.map(doc => doc.data());

        if (checkOverlap(currentBookings, startTime, endTime)) {
            alert('This time slot overlaps with an existing booking. Please choose another time.');
            return;
        }

        modalTimeSlot.textContent = `Time: ${startTime} - ${endTime}`;
        modal.style.display = 'flex';
        bookingForm.dataset.startTime = startTime;
        bookingForm.dataset.endTime = endTime;
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
