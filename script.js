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
    const startHourSelect = document.getElementById('start-hour');
    const startMinuteSelect = document.getElementById('start-minute');
    const endHourSelect = document.getElementById('end-hour');
    const endMinuteSelect = document.getElementById('end-minute');

    const bookingsCollection = db.collection('bookings');

    // --- Populate Hour and Minute Dropdowns ---
    const populateTimePickers = () => {
        for (let i = 0; i < 24; i++) {
            const hour = String(i).padStart(2, '0');
            startHourSelect.innerHTML += `<option value="${hour}">${hour}</option>`;
            endHourSelect.innerHTML += `<option value="${hour}">${hour}</option>`;
        }
        for (let i = 0; i < 60; i += 5) { // 5-minute intervals for minutes
            const minute = String(i).padStart(2, '0');
            startMinuteSelect.innerHTML += `<option value="${minute}">${minute}</option>`;
            endMinuteSelect.innerHTML += `<option value="${minute}">${minute}</option>`;
        }
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
            bookedSlot.innerHTML = `
                <strong>${booking.startTime} - ${booking.endTime}</strong>
                <span>${booking.name} - ${booking.project}</span>
            `;
            bookedTimesList.appendChild(bookedSlot);
        });
    };
    
    // --- Highlight Unavailable Slots ---
    const highlightUnavailableSlots = (bookings) => {
        // Clear all previous highlights
        document.querySelectorAll('.time-picker-group option').forEach(option => {
            option.classList.remove('unavailable');
        });

        const allSlots = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const hour = String(h).padStart(2, '0');
                const minute = String(m).padStart(2, '0');
                allSlots.push({
                    time: `${hour}:${minute}`,
                    minutes: timeToMinutes(`${hour}:${minute}`)
                });
            }
        }
        
        allSlots.forEach(slot => {
            const isUnavailable = bookings.some(booking => {
                const startMinutes = timeToMinutes(booking.startTime);
                const endMinutes = timeToMinutes(booking.endTime);
                return (slot.minutes >= startMinutes && slot.minutes < endMinutes);
            });

            if (isUnavailable) {
                document.querySelectorAll(`option[value="${slot.time.substring(0,2)}"]`).forEach(el => {
                    if (el.parentElement.id.includes('hour')) el.classList.add('unavailable');
                });
                document.querySelectorAll(`option[value="${slot.time.substring(3,5)}"]`).forEach(el => {
                    if (el.parentElement.id.includes('minute')) el.classList.add('unavailable');
                });
            }
        });
    };

    // --- Check for Time Overlaps (for booking) ---
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
        highlightUnavailableSlots(bookings);
    }, error => {
        console.error("Error fetching documents: ", error);
        bookedTimesList.textContent = "Failed to connect to the database.";
    });
    
    // --- Handle Custom Time Booking Button Click ---
    bookCustomBtn.addEventListener('click', async () => {
        const customStartTime = `${startHourSelect.value}:${startMinuteSelect.value}`;
        const customEndTime = `${endHourSelect.value}:${endMinuteSelect.value}`;

        if (timeToMinutes(customStartTime) >= timeToMinutes(customEndTime)) {
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
    
    populateTimePickers();
    generateQRCode();
});
