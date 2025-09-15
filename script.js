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
    const timeSlotsGrid = document.getElementById('time-slots-grid');
    const modal = document.getElementById('booking-modal');
    const modalTimeSlot = document.getElementById('modal-time-slot');
    const bookingForm = document.getElementById('booking-form');
    const closeBtn = document.querySelector('.close-btn');

    const bookingsCollection = db.collection('bookings');

    const pad = n => String(n).padStart(2, '0');

    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const timeToMinutes = (time) => {
        const [hourStr, minuteStr] = time.split(':').map(s => s.trim());
        const hours = Number(hourStr);
        const minutes = Number(minuteStr);
        return hours * 60 + minutes;
    };

    const isBookingDone = (endTime) => {
        const nowMinutes = timeToMinutes(getCurrentTime());
        return timeToMinutes(endTime) <= nowMinutes;
    };

    const getCurrentTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };
    
    // checks for overlap between a new slot and an existing booking
    const checkOverlap = (bookings, newStart, newEnd) => {
        const newStartMinutes = timeToMinutes(newStart);
        const newEndMinutes = timeToMinutes(newEnd);
        return bookings.some(booking => {
            const existingStartMinutes = timeToMinutes(booking.startTime);
            const existingEndMinutes = timeToMinutes(booking.endTime);
            return (newStartMinutes < existingEndMinutes) && (newEndMinutes > existingStartMinutes);
        });
    };

    const renderBookedTimes = (bookings) => {
        bookedTimesList.innerHTML = '';
        if (!bookings || bookings.length === 0) {
            bookedTimesList.textContent = "No bookings for today. All clear!";
            bookedTimesList.style.textAlign = 'center';
            return;
        }

        bookings.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        bookings.forEach(booking => {
            const bookedSlot = document.createElement('div');
            bookedSlot.classList.add('booked-slot');
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

    // generates the grid of available time slots
    const generateTimeSlots = (bookedSlots) => {
        timeSlotsGrid.innerHTML = '';
        const now = new Date();
        let currentMinutes = now.getHours() * 60 + now.getMinutes();
        const interval = 30; 

        for (let i = 0; i < 24 * 60 / interval; i++) {
            const slotStartMinutes = i * interval;
            const slotEndMinutes = slotStartMinutes + interval;

            const startHour = pad(Math.floor(slotStartMinutes / 60));
            const startMinute = pad(slotStartMinutes % 60);
            const endHour = pad(Math.floor(slotEndMinutes / 60));
            const endMinute = pad(slotEndMinutes % 60);
            const startTime = `${startHour}:${startMinute}`;
            const endTime = `${endHour}:${endMinute}`;

            const isBooked = checkOverlap(bookedSlots, startTime, endTime);
            const isPast = slotEndMinutes <= currentMinutes;

            const slotElement = document.createElement('button');
            slotElement.textContent = `${startTime} - ${endTime}`;
            slotElement.dataset.startTime = startTime;
            slotElement.dataset.endTime = endTime;
            slotElement.classList.add('time-slot-btn');

            if (isBooked || isPast) {
                slotElement.disabled = true;
                slotElement.classList.add('booked');
            } else {
                slotElement.addEventListener('click', () => {
                    modalTimeSlot.textContent = `Time: ${startTime} - ${endTime}`;
                    modal.style.display = 'flex';
                    bookingForm.dataset.startTime = startTime;
                    bookingForm.dataset.endTime = endTime;
                });
            }
            timeSlotsGrid.appendChild(slotElement);
        }
    };

    // Real-time Firestore Listener
    const todayDate = getTodayDate();
    bookingsCollection.where('date', '==', todayDate).onSnapshot(querySnapshot => {
        const bookings = [];
        querySnapshot.forEach(doc => bookings.push(doc.data()));
        renderBookedTimes(bookings);
        generateTimeSlots(bookings); // re-generate time slots to reflect new bookings
    }, error => {
        console.error("Error fetching documents: ", error);
        bookedTimesList.textContent = "Failed to connect to the database.";
    });

    // Handle Booking Confirmation from Modal
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const project = document.getElementById('project').value;
        const startTime = bookingForm.dataset.startTime;
        const endTime = bookingForm.dataset.endTime;
        const bookingDate = getTodayDate();

        try {
            // Re-check for overlap just in case another user booked the slot a moment ago
            const snapshot = await bookingsCollection.where('date', '==', todayDate).get();
            const currentBookings = snapshot.docs.map(doc => doc.data());
            if (checkOverlap(currentBookings, startTime, endTime)) {
                alert('This slot was just booked. Please choose another one.');
                modal.style.display = 'none';
                return;
            }

            await bookingsCollection.add({
                name: name,
                project: project,
                startTime: startTime,
                endTime: endTime,
                date: bookingDate,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Booking confirmed!');
            modal.style.display = 'none';
            document.getElementById('name').value = '';
            document.getElementById('project').value = '';
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to book the slot. Please try again.");
        }
    });

    // Modal Control
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});
