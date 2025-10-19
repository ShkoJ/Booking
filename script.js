document.addEventListener('DOMContentLoaded', () => {
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

    // DOM Elements
    const loginModal = document.getElementById('login-modal');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const bookingDateInput = document.getElementById('booking-date');
    const startTimeSelect = document.getElementById('start-time');
    const endTimeSelect = document.getElementById('end-time');
    const checkBtn = document.getElementById('check-availability-btn');
    const bookedTimesList = document.getElementById('booked-times-list');
    const bookingModal = document.getElementById('booking-modal');
    const editModal = document.getElementById('edit-modal');
    const modalTimeSlot = document.getElementById('modal-time-slot');
    const editTimeSlot = document.getElementById('edit-time-slot');
    const bookingForm = document.getElementById('booking-form');
    const editForm = document.getElementById('edit-form');
    const closeBtns = document.querySelectorAll('.close-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');

    const bookingsCollection = db.collection('bookings');
    let selectedDate = '', currentUser = null, editingId = null;

    // LOGIN
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('user-email').value;
        const pin = document.getElementById('user-pin').value;
        
        if (pin === '123456') {
            currentUser = { email };
            localStorage.setItem('meetingUser', JSON.stringify({ email }));
            userInfo.textContent = email;
            loginModal.style.display = 'none';
            mainApp.style.display = 'block';
            initApp();
        } else {
            alert('❌ Wrong PIN! (123456)');
        }
    });

    // AUTO-LOGIN
    const savedUser = localStorage.getItem('meetingUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        userInfo.textContent = currentUser.email;
        loginModal.style.display = 'none';
        mainApp.style.display = 'block';
        initApp();
    }

    // FIXED LOGOUT
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('meetingUser');
        currentUser = null;
        mainApp.style.display = 'none';
        loginModal.style.display = 'flex';
        document.getElementById('user-email').value = '';
        document.getElementById('user-pin').value = '';
        bookedTimesList.innerHTML = '<p>Please login to view bookings.</p>';
    });

    function initApp() {
        flatpickr(bookingDateInput, {
            minDate: "today", dateFormat: "Y-m-d",
            onChange: (selectedDates, dateStr) => {
                selectedDate = dateStr;
                fetchBookings(selectedDate);
            }
        });
        fetchBookings(new Date().toISOString().split('T')[0]);
    }

    const pad = n => String(n).padStart(2, '0');
    const timeToMinutes = time => { const [h, m] = time.split(':').map(s => s.trim()); return Number(h) * 60 + Number(m); };
    const getCurrentMinutes = () => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); };
    const isBookingDone = endTime => { const now = new Date(); const today = now.toISOString().split('T')[0]; if (selectedDate !== today) return false; return timeToMinutes(endTime) <= getCurrentMinutes(); };
    const isBookingOngoing = (start, end) => { const now = new Date(); const today = now.toISOString().split('T')[0]; if (selectedDate !== today) return false; const current = getCurrentMinutes(); return timeToMinutes(start) <= current && current < timeToMinutes(end); };
    const checkOverlap = (bookings, newStart, newEnd) => { const s1 = timeToMinutes(newStart), e1 = timeToMinutes(newEnd); return bookings.some(b => { const s2 = timeToMinutes(b.startTime), e2 = timeToMinutes(b.endTime); return s1 < e2 && e1 > s2; }); };

    const renderBookedTimes = (bookings) => {
        bookedTimesList.innerHTML = '';
        if (!bookings?.length) {
            bookedTimesList.innerHTML = '<p>No bookings for this date. All clear!</p>';
            bookedTimesList.style.textAlign = 'center';
            return;
        }
        bookings.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        bookings.forEach(booking => {
            const isOwner = booking.ownerEmail === currentUser.email;
            const bookedSlot = document.createElement('div');
            bookedSlot.className = 'booked-slot';
            
            let status = '';
            if (isBookingOngoing(booking.startTime, booking.endTime)) {
                bookedSlot.classList.add('ongoing');
                status = '<span class="status-label status-ongoing">Ongoing</span>';
            } else if (isBookingDone(booking.endTime)) {
                bookedSlot.classList.add('done');
                status = '<span class="status-label">Done</span>';
            } else {
                bookedSlot.classList.add('upcoming');
                status = '<span class="status-label status-upcoming">Upcoming</span>';
            }

            bookedSlot.innerHTML = `
                <div>
                    <strong>${booking.startTime} - ${booking.endTime}</strong>
                    <span>${booking.project}</span>
                    ${isOwner ? `<br><small style="color:#27ae60">👤 Your meeting</small>` : ''}
                </div>
                <div>
                    ${status}
                    ${isOwner ? `
                        <button class="edit-btn" data-id="${booking.id}" data-start="${booking.startTime}" data-end="${booking.endTime}" data-project="${booking.project}" data-date="${booking.date}">✏️</button>
                        <button class="delete-btn" data-id="${booking.id}">🗑️</button>
                    ` : ''}
                </div>
            `;
            bookedTimesList.appendChild(bookedSlot);
        });
    };

    const fetchBookings = date => {
        if (!date) return;
        bookingsCollection.where('date', '==', date).onSnapshot(snap => {
            const bookings = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            renderBookedTimes(bookings);
            populateTimeSelectors(bookings);
        });
    };

    const populateTimeSelectors = (bookings) => {
        [startTimeSelect, endTimeSelect].forEach(select => select.innerHTML = '');
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentMinutes = getCurrentMinutes();
        const interval = 30;

        if (selectedDate === today) {
            const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const nowOption = new Option(`Now (${nowTime})`, nowTime);
            nowOption.className = 'now-option';
            if (checkOverlap(bookings, nowTime, `${pad(now.getHours())}:${pad(now.getMinutes() + 1)}`)) nowOption.disabled = true;
            startTimeSelect.add(nowOption);
        }

        for (let i = 0; i < 24 * 60 / interval; i++) {
            const mins = i * interval;
            const time = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
            const option = new Option(time, time);
            const isPast = selectedDate === today && mins <= currentMinutes;
            const isBooked = checkOverlap(bookings, time, `${pad(Math.floor((mins + interval) / 60))}:${pad((mins + interval) % 60)}`);
            if (isPast || isBooked) { option.disabled = true; option.className = 'unavailable'; }
            startTimeSelect.add(option);
        }

        const updateEndTimes = () => {
            endTimeSelect.innerHTML = '';
            const start = startTimeSelect.value;
            if (!start) return;
            const startMins = timeToMinutes(start);
            for (let i = Math.ceil(startMins / interval); i <= 24 * 60 / interval; i++) {
                const mins = i * interval;
                if (mins <= startMins) continue;
                const time = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
                const option = new Option(time, time);
                if (checkOverlap(bookings, start, time)) { option.disabled = true; option.className = 'unavailable'; }
                endTimeSelect.add(option);
            }
        };
        startTimeSelect.addEventListener('change', updateEndTimes);
        updateEndTimes();
    };

    // BUTTONS
    document.addEventListener('click', async e => {
        if (e.target.classList.contains('delete-btn')) {
            if (confirm('Delete your meeting?')) {
                await bookingsCollection.doc(e.target.dataset.id).delete();
                alert('✅ Deleted!');
            }
        }
        if (e.target.classList.contains('edit-btn')) {
            editingId = e.target.dataset.id;
            const startTime = e.target.dataset.start;
            const endTime = e.target.dataset.end;
            const project = e.target.dataset.project;
            const editDate = e.target.dataset.date;
            
            // Set date picker
            bookingDateInput.value = editDate;
            selectedDate = editDate;
            fetchBookings(selectedDate);
            
            setTimeout(() => {
                startTimeSelect.value = startTime;
                endTimeSelect.value = endTime;
                startTimeSelect.dispatchEvent(new Event('change'));
            }, 500);
            
            document.getElementById('edit-project').value = project;
            editTimeSlot.innerHTML = `<strong>${startTime} - ${endTime}</strong> on ${editDate}<br><small>Change time below & click Save</small>`;
            editModal.style.display = 'flex';
        }
    });

    // NEW BOOKING
    bookingForm.addEventListener('submit', async e => {
        e.preventDefault();
        const project = document.getElementById('project').value;
        const startTime = bookingForm.dataset.startTime;
        const endTime = bookingForm.dataset.endTime;

        const snapshot = await bookingsCollection.where('date', '==', selectedDate).get();
        if (checkOverlap(snapshot.docs.map(d => d.data()), startTime, endTime)) {
            alert('Slot taken! Try another.');
            return;
        }

        await bookingsCollection.add({
            ownerEmail: currentUser.email,
            project, startTime, endTime, date: selectedDate,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        bookingModal.style.display = 'none';
        document.getElementById('project').value = '';
        document.getElementById('success-message').classList.add('visible-message');
        setTimeout(() => document.getElementById('success-message').classList.remove('visible-message'), 3000);
    });

    // EDIT FORM
    editForm.addEventListener('submit', async e => {
        e.preventDefault();
        const project = document.getElementById('edit-project').value;
        const startTime = startTimeSelect.value;
        const endTime = endTimeSelect.value;

        const snapshot = await bookingsCollection.where('date', '==', selectedDate).get();
        if (checkOverlap(snapshot.docs.map(d => d.data()), startTime, endTime)) {
            alert('New time slot taken! Choose another.');
            return;
        }

        await bookingsCollection.doc(editingId).update({
            project, startTime, endTime, date: selectedDate
        });

        editModal.style.display = 'none';
        alert('✅ Meeting updated!');
    });

    checkBtn.addEventListener('click', () => {
        const start = startTimeSelect.value, end = endTimeSelect.value;
        if (!selectedDate || !start || !end || timeToMinutes(end) <= timeToMinutes(start)) {
            alert('Please select valid date/time.');
            return;
        }
        modalTimeSlot.textContent = `${start} - ${end} on ${selectedDate}`;
        bookingForm.dataset.startTime = start;
        bookingForm.dataset.endTime = end;
        bookingModal.style.display = 'flex';
    });

    closeBtns.forEach(btn => btn.addEventListener('click', () => {
        bookingModal.style.display = 'none';
        editModal.style.display = 'none';
    }));
    window.addEventListener('click', e => {
        if (e.target === bookingModal) bookingModal.style.display = 'none';
        if (e.target === editModal) editModal.style.display = 'none';
    });
});
