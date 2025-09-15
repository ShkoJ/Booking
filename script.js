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

    // New elements: selects for start/end
    const startHourSelect = document.getElementById('start-hour');
    const startMinuteSelect = document.getElementById('start-minute');
    const endHourSelect = document.getElementById('end-hour');
    const endMinuteSelect = document.getElementById('end-minute');

    const bookingsCollection = db.collection('bookings');

    // helpers
    const pad = n => String(n).padStart(2, '0');

    // populate select options: hours 01..24, minutes 00,05,...,55
    const populateTimeSelects = () => {
        // Hours 1..24 (display as 01..24)
        for (let h = 1; h <= 24; h++) {
            const v = pad(h);
            [startHourSelect, endHourSelect].forEach(sel => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                sel.appendChild(opt);
            });
        }
        // Minutes step 5
        for (let m = 0; m < 60; m += 5) {
            const v = pad(m);
            [startMinuteSelect, endMinuteSelect].forEach(sel => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                sel.appendChild(opt);
            });
        }
    };

    // Convert our 1-24 hour display back to numeric 0-24 for math:
    // '24' => 24, '01' => 1, etc.
    // time string format: "HH:MM" where HH may be 01..24
    const timeToMinutes = (time) => {
        const [hourStr, minuteStr] = time.split(':').map(s => s.trim());
        const hours = Number(hourStr);
        const minutes = Number(minuteStr);
        return hours * 60 + minutes;
    };

    const getTodayDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // returns "HH:MM" with HH using two digits 01..24 (24 allowed for midnight end)
    const getCurrentTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0'); // 00..23
        const minutes = String(now.getMinutes()).padStart(2, '0');
        // convert 00 to 24 only for display consistency? We'll keep 00 as 00 for current-time comparisons.
        // NOTE: timeToMinutes handles both 00..23 and 24.
        return `${hours}:${minutes}`;
    };

    // is booking finished (use minute arithmetic)
    const isBookingDone = (endTime) => {
        // compare minutes
        const nowMinutes = timeToMinutes(getCurrentTime());
        return timeToMinutes(endTime) <= nowMinutes;
    };

    // return time from selects
    const getSelectedTime = (which) => {
        if (which === 'start') {
            return `${startHourSelect.value}:${startMinuteSelect.value}`;
        } else {
            return `${endHourSelect.value}:${endMinuteSelect.value}`;
        }
    };

    // Render Booked Times (sort by numeric minutes)
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

    // overlap check (same logic, numeric)
    const checkOverlap = (bookings, newStart, newEnd) => {
        const newStartMinutes = timeToMinutes(newStart);
        const newEndMinutes = timeToMinutes(newEnd);

        return bookings.some(booking => {
            const existingStartMinutes = timeToMinutes(booking.startTime);
            const existingEndMinutes = timeToMinutes(booking.endTime);
            return (newStartMinutes < existingEndMinutes) && (newEndMinutes > existingStartMinutes);
        });
    };

    // set default times: now rounded up to 5 min, end = +30 min
    const setDefaultTimes = () => {
        const now = new Date();
        let h = now.getHours(); // 0..23
        let m = Math.ceil(now.getMinutes() / 5) * 5;
        if (m === 60) { m = 0; h = (h + 1) % 24; }

        // displayHour: convert 0 -> "24" only if you prefer; for clarity we map 0 -> "00" here.
        // Because most users expect 00:xx at midnight; if you want 24, we could map 0 -> 24.
        const displayHour = (h === 0) ? '00' : pad(h); // NOTE: your requirement was 1-24; if you want 01..24 mapping, change this mapping.
        // but to follow your 1-24 request exactly, map 0 -> 24 and 1..23 -> 01..23:
        const displayHour1to24 = (h === 0) ? '24' : pad(h);

        startHourSelect.value = displayHour1to24;
        startMinuteSelect.value = pad(m);

        // end time +30 minutes
        let totalMinutes = h * 60 + m + 30;
        let eh = Math.floor(totalMinutes / 60) % 24; // 0..23
        let em = totalMinutes % 60;
        const displayEndHour1to24 = (eh === 0) ? '24' : pad(eh);

        endHourSelect.value = displayEndHour1to24;
        endMinuteSelect.value = pad(em);
    };

    // Real-time Firestore Listener (with filter)
    const todayDate = getTodayDate();
    bookingsCollection.where('date', '==', todayDate).onSnapshot(querySnapshot => {
        const bookings = [];
        querySnapshot.forEach(doc => bookings.push(doc.data()));
        renderBookedTimes(bookings);
    }, error => {
        console.error("Error fetching documents: ", error);
        bookedTimesList.textContent = "Failed to connect to the database.";
    });

    // Initialize selects
    populateTimeSelects();
    setDefaultTimes();

    // Handle Custom Time Booking Button Click
    bookCustomBtn.addEventListener('click', async () => {
        const customStartTime = getSelectedTime('start');
        const customEndTime = getSelectedTime('end');

        if (!customStartTime || !customEndTime) {
            alert('Please select both a start and end time.');
            return;
        }

        if (timeToMinutes(customStartTime) >= timeToMinutes(customEndTime)) {
            alert('End time must be after start time.');
            return;
        }

        // Prevent booking a time that has already passed
        if (timeToMinutes(customStartTime) < timeToMinutes(getCurrentTime())) {
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

    // Handle Booking Confirmation from Modal
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

    // Modal Control
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // QR Code Generation
    const generateQRCode = () => {
        const pageURL = window.location.href;
        if (pageURL && QRCode) {
            document.getElementById("qrcode").innerHTML = '';
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
