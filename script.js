document.addEventListener('DOMContentLoaded', () => {
    // Firebase Configuration - REPLACE WITH YOUR NEW CONFIG
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID",
        measurementId: "YOUR_MEASUREMENT_ID"
    };

    // Initialize Firebase
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

    // Firestore Collection Reference
    const bookingsCollection = db.collection('bookings');

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
            bookedSlot.innerHTML = `<strong>${booking.startTime} - ${booking.endTime}</strong><br><span>${booking.name}</span>`;
            bookedTimesList.appendChild(bookedSlot);
        });
    };

    // --- Check for Time Overlaps ---
    const checkOverlap = (bookings, newStart, newEnd) => {
        return bookings.some(booking => {
            const start1 = booking.startTime;
            const end1 = booking.endTime;
            const start2 = newStart;
            const end2 = newEnd;
            return (start2 < end1) && (end2 > start1);
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
        alert("Failed to connect to the database. Please try again.");
    });
    
    // --- Handle Booking Form Submission (from custom time) ---
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
            alert('This custom time range overlaps with an existing booking. Please choose another time.');
            return;
        }

        modalTimeSlot.textContent = `Custom Time: ${customStartTime} - ${customEndTime}`;
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
