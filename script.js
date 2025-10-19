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

    const bookingDateInput = document.getElementById('booking-date');
    const startTimeSelect = document.getElementById('start-time');
    const endTimeSelect = document.getElementById('end-time');
    const checkBtn = document.getElementById('check-availability-btn');
    const bookedTimesList = document.getElementById('booked-times-list');
    const modal = document.getElementById('booking-modal');
    const modalTimeSlot = document.getElementById('modal-time-slot');
    const bookingForm = document.getElementById('booking-form');
    const closeBtn = document.querySelector('.close-btn');
    const deletePasswordInput = document.getElementById('delete-password');
    const todayBtn = document.getElementById('today-btn');

    const bookingsCollection = db.collection('bookings');
    let selectedDate = '';
    let datePickerInstance; 

    // Initialize Flatpickr for the date picker
    datePickerInstance = flatpickr(bookingDateInput, { // Save the instance
        minDate: "today",
        dateFormat: "Y-m-d",
        onChange: (selectedDates, dateStr, instance) => {
            selectedDate = dateStr;
            fetchBookings(selectedDate);
        }
    });

    const pad = n => String(n).padStart(2, '0');

    const timeToMinutes = (time) => {
        const [hourStr, minuteStr] = time.split(':').map(s => s.trim());
        const hours = Number(hourStr);
        const minutes = Number(minuteStr);
        return hours * 60 + minutes;
    };

    const getCurrentMinutes = () => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    };

    const isBookingDone = (endTime) => {
        const now = new Date();
        const todayDate = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
        if (selectedDate !== todayDate) {
            return false;
        }
        return timeToMinutes(endTime) <= getCurrentMinutes();
    };

    const isBookingOngoing = (startTime, endTime) => {
        const now = new Date();
        const todayDate = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
        if (selectedDate !== todayDate) {
            return false;
        }
        const currentMinutes = getCurrentMinutes();
        return timeToMinutes(startTime) <= currentMinutes && currentMinutes < timeToMinutes(endTime);
    };

    const checkOverlap = (bookings, newStart, newEnd) => {
        const newStartMinutes = timeToMinutes(newStart);
        const newEndMinutes = timeToMinutes(newEnd);
        return bookings.some(booking => {
            const existingStartMinutes = timeToMinutes(booking.startTime);
            const existingEndMinutes = timeToMinutes(booking.endTime);
            return (newStartMinutes < existingEndMinutes) && (newEndMinutes > existingStartMinutes);
        });
    };

    const deleteBooking = async (bookingId, password) => {
        if (password.length < 4) {
            alert('Password must be at least 4 characters long.');
            return;
        }

        try {
            const docRef = bookingsCollection.doc(bookingId);
            const doc = await docRef.get();

            if (!doc.exists) {
                alert('Booking not found.');
                return;
            }

            const bookingData = doc.data();

            // Simple password check (Note: In a real app, use hashing/authentication)
            if (bookingData.deletePassword === password) {
                await docRef.delete();
                alert('Meeting successfully deleted!');
            } else {
                alert('Incorrect password. You cannot delete this meeting.');
            }
        } catch (error) {
            console.error("Error deleting document: ", error);
            alert("Failed to delete the booking. Please check the console for details.");
        }
    };

    const renderBookedTimes = (bookings) => {
        bookedTimesList.innerHTML = '';
        if (!bookings || bookings.length === 0) {
            bookedTimesList.textContent = "No bookings for this date. All clear!";
            bookedTimesList.style.textAlign = 'center';
            return;
        }

        bookings.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        bookings.forEach(booking => {
            const bookedSlot = document.createElement('div');
            bookedSlot.classList.add('booked-slot');

            let statusLabel = '';
            if (isBookingOngoing(booking.startTime, booking.endTime)) {
                bookedSlot.classList.add('ongoing');
                statusLabel = '<span class="status-label status-ongoing">Ongoing</span>';
            } else if (isBookingDone(booking.endTime)) {
                bookedSlot.classList.add('done');
                statusLabel = '<span class="status-label">Done</span>';
            } else {
                bookedSlot.classList.add('upcoming');
                statusLabel = '<span class="status-label status-upcoming">Upcoming</span>';
            }

            bookedSlot.innerHTML = `
                <div>
                    <strong>${booking.startTime} - ${booking.endTime}</strong>
                    <span>${booking.name} - ${booking.project}</span>
                </div>
                <div>
                    ${statusLabel}
                    <button class="delete-btn" data-id="${booking.id}">&times;</button>
                </div>
            `;
            bookedTimesList.appendChild(bookedSlot);
        });
        
        // Add event listener for the delete buttons
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                const passwordPrompt = prompt("Enter your deletion password to confirm:");
                if (passwordPrompt !== null) { // User clicked OK/Cancel
                    deleteBooking(bookingId, passwordPrompt.trim());
                }
            });
        });
    };

    const fetchBookings = (date) => {
        if (!date) return;
        bookingsCollection.where('date', '==', date).onSnapshot(querySnapshot => {
            const bookings = [];
            querySnapshot.forEach(doc => {
                bookings.push({ ...doc.data(), id: doc.id });
            });
            renderBookedTimes(bookings);
            populateTimeSelectors(bookings);
        }, error => {
            console.error("Error fetching documents: ", error);
            bookedTimesList.textContent = "Failed to connect to the database.";
        });
    };

    const populateTimeSelectors = (bookedSlots) => {
        startTimeSelect.innerHTML = '';
        endTimeSelect.innerHTML = '';
        const now = new Date();
        const todayDate = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
        const currentMinutes = getCurrentMinutes();
        const interval = 30; // 30-minute intervals

        // Add 'Now' option if the selected date is today
        if (selectedDate === todayDate) {
            const nowHour = pad(now.getHours());
            const nowMinute = pad(now.getMinutes());
            const nowTime = `${nowHour}:${nowMinute}`;
            
            // Calculate end time for 'now' to check for overlap, e.g., 1 minute from now
            const nowPlusOne = new Date(now.getTime() + 60000);
            const checkEndTime = `${pad(nowPlusOne.getHours())}:${pad(nowPlusOne.getMinutes())}`;

            const nowOption = document.createElement('option');
            nowOption.value = nowTime;
            nowOption.textContent = `Now (${nowTime})`;
            nowOption.classList.add('now-option');
            nowOption.dataset.now = "true";

            // Check if 'Now' time slot is available
            const isNowBooked = checkOverlap(bookedSlots, nowTime, checkEndTime);
            if (isNowBooked) {
                nowOption.disabled = true;
                nowOption.classList.add('unavailable');
                nowOption.textContent += ' (Unavailable)';
            }
            startTimeSelect.appendChild(nowOption);
        }

        // Start Time dropdown
        for (let i = 0; i < 24 * 60 / interval; i++) {
            const slotStartMinutes = i * interval;
            const slotStartHour = pad(Math.floor(slotStartMinutes / 60));
            const slotStartMinute = pad(slotStartMinutes % 60);
            const startTime = `${slotStartHour}:${slotStartMinute}`;

            const option = document.createElement('option');
            option.value = startTime;
            option.textContent = startTime;

            const isPast = selectedDate === todayDate && slotStartMinutes <= currentMinutes;
            const isBooked = checkOverlap(bookedSlots, startTime, `${pad(Math.floor((slotStartMinutes + interval) / 60))}:${pad((slotStartMinutes + interval) % 60)}`);

            if (isPast || isBooked) {
                option.disabled = true;
                option.classList.add('unavailable');
            }
            startTimeSelect.appendChild(option);
        }

        const updateEndTimeOptions = () => {
            endTimeSelect.innerHTML = '';
            const selectedStartTime = startTimeSelect.value;
            if (!selectedStartTime) return;

            let startMinutes = timeToMinutes(selectedStartTime);
            for (let i = Math.ceil(startMinutes / interval); i <= 24 * 60 / interval; i++) {
                const slotEndMinutes = i * interval;
                if (slotEndMinutes <= startMinutes) continue;

                const slotEndHour = pad(Math.floor(slotEndMinutes / 60));
                const slotEndMinute = pad(slotEndMinutes % 60);
                const endTime = `${slotEndHour}:${slotEndMinute}`;

                const option = document.createElement('option');
                option.value = endTime;
                option.textContent = endTime;

                const isBooked = checkOverlap(bookedSlots, selectedStartTime, endTime);
                if (isBooked) {
                    option.disabled = true;
                    option.classList.add('unavailable');
                }
                endTimeSelect.appendChild(option);
            }
        };

        startTimeSelect.addEventListener('change', updateEndTimeOptions);
        updateEndTimeOptions();
    };

    // Event Listener for the 'Today' button
    todayBtn.addEventListener('click', () => {
        // Set the date input to the current date and trigger the change handler
        datePickerInstance.setDate('today', true);
    });

    // Handle Booking Confirmation from Modal
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const project = document.getElementById('project').value;
        const deletePassword = deletePasswordInput.value; // Get the password
        const startTime = bookingForm.dataset.startTime;
        const endTime = bookingForm.dataset.endTime;
        const bookingDate = selectedDate;

        if (!bookingDate) {
            alert('Please select a date first.');
            return;
        }

        // Simple password validation check
        if (deletePassword.length < 4) {
            alert('Please enter a deletion password of at least 4 characters.');
            return;
        }

        try {
            const snapshot = await bookingsCollection.where('date', '==', bookingDate).get();
            const currentBookings = snapshot.docs.map(doc => doc.data());
            if (checkOverlap(currentBookings, startTime, endTime)) {
                alert('This slot was just booked. Please choose another one.');
                modal.style.display = 'none';
                return;
            }

            await bookingsCollection.add({
                name: name,
                project: project,
                // --- Save the password with the booking ---
                deletePassword: deletePassword, 
                // ------------------------------------------
                startTime: startTime,
                endTime: endTime,
                date: bookingDate,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            modal.style.display = 'none';
            document.getElementById('name').value = '';
            document.getElementById('project').value = '';
            deletePasswordInput.value = ''; // Clear the password field

            const successMessage = document.getElementById('success-message');
            successMessage.classList.add('visible-message');
            setTimeout(() => {
                successMessage.classList.remove('visible-message');
            }, 3000);

        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to book the slot. Please try again.");
        }
    });

    // Check Availability & Book Button
    checkBtn.addEventListener('click', () => {
        const startTime = startTimeSelect.value;
        const endTime = endTimeSelect.value;

        if (!selectedDate) {
            alert('Please select a date first.');
            return;
        }
        if (!startTime || !endTime) {
            alert('Please select both a start and end time.');
            return;
        }

        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        if (endMinutes <= startMinutes) {
            alert('End time must be after start time.');
            return;
        }

        modalTimeSlot.textContent = `Time: ${startTime} - ${endTime} on ${selectedDate}`;
        bookingForm.dataset.startTime = startTime;
        bookingForm.dataset.endTime = endTime;
        modal.style.display = 'flex';
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
