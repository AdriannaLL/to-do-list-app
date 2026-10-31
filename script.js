const addForm = document.getElementById("add_form");
const taskInput = document.getElementById("task_input");
const importanceSelect = document.getElementById("importance_select");
const errorMsg = document.getElementById("error_msg");
const listError = document.getElementById("list_error");
const emptyMsg = document.getElementById("empty_msg");
const taskList = document.getElementById("task_list");

const doingNowTitle = document.getElementById("doing_now_title");
const timerDisplay = document.getElementById("timer_display");
const durationSelect = document.getElementById("duration_select");
const startBtn = document.getElementById("start_btn");
const resetBtn = document.getElementById("reset_btn");
const clearBtn = document.getElementById("clear_btn");

const modalOverlay = document.getElementById("modal_overlay");
const modalTaskTitle = document.getElementById("modal_task_title");
const yesBtn = document.getElementById("yes_btn");
const noBtn = document.getElementById("no_btn");

const importanceRank = { High: 0, Medium: 1, Low: 2 };
const importanceLevels = ["High", "Medium", "Low"];

let tasks = [];
let nextId = 1;
let orderCount = 0;
let doingNowId = null;
let editingId = null;
let timerId = null;
let remaining = getDuration();
let promptOpen = false;

function showGreeting() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Good evening,";

    if (hour < 12) {
        greeting = "Good morning,";
    } else if (hour < 17) {
        greeting = "Good afternoon,";
    }

    document.getElementById("greeting_text").textContent = greeting;
    document.getElementById("date_text").textContent = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric"
    });
}

function findTask(id) {
    return tasks.find(function(task) {
        return task.id === id;
    });
}

function getDuration() {
    return Number(durationSelect.value) * 60;
}

function formatTime(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return mins + ":" + secs;
}

function getSortedTasks() {
    const active = tasks.filter(function(task) {
        return !task.completed;
    });
    const completed = tasks.filter(function(task) {
        return task.completed;
    });

    active.sort(function(a, b) {
        if (importanceRank[a.importance] !== importanceRank[b.importance]) {
            return importanceRank[a.importance] - importanceRank[b.importance];
        }
        return a.order - b.order;
    });

    completed.sort(function(a, b) {
        return a.order - b.order;
    });

    return active.concat(completed);
}

function makeButton(text, className, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = className;
    button.addEventListener("click", onClick);
    return button;
}

function createTaskItem(task) {
    const li = document.createElement("li");
    li.className = "task_item importance_" + task.importance.toLowerCase();

    if (task.completed) {
        li.classList.add("completed");
    }
    if (task.id === doingNowId) {
        li.classList.add("doing_now");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task_check";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", function() {
        toggleComplete(task.id, checkbox.checked);
    });

    const info = document.createElement("div");
    info.className = "task_info";

    const actions = document.createElement("div");
    actions.className = "task_actions";

    if (task.id === editingId) {
        const editInput = document.createElement("input");
        editInput.type = "text";
        editInput.className = "edit_input";
        editInput.value = task.title;
        editInput.addEventListener("keydown", function(event) {
            if (event.key === "Enter") {
                saveEdit(task.id, editInput.value);
            } else if (event.key === "Escape") {
                cancelEdit();
            }
        });
        info.appendChild(editInput);

        actions.appendChild(makeButton("Save", "save_btn", function() {
            saveEdit(task.id, editInput.value);
        }));
        actions.appendChild(makeButton("Cancel", "cancel_btn", cancelEdit));
    } else {
        const title = document.createElement("span");
        title.className = "task_title";
        title.textContent = task.title;
        info.appendChild(title);

        const importanceDropdown = document.createElement("select");
        importanceDropdown.className = "task_importance";
        importanceLevels.forEach(function(level) {
            const option = document.createElement("option");
            option.value = level;
            option.textContent = level;
            importanceDropdown.appendChild(option);
        });
        importanceDropdown.value = task.importance;
        importanceDropdown.addEventListener("change", function() {
            changeImportance(task.id, importanceDropdown.value);
        });
        actions.appendChild(importanceDropdown);

        if (!task.completed) {
            if (task.id === doingNowId) {
                actions.appendChild(makeButton("Clear", "doing_btn", function() {
                    clearDoingNow();
                    renderTasks();
                }));
            } else {
                actions.appendChild(makeButton("Doing Now", "doing_btn", function() {
                    setDoingNow(task.id);
                }));
            }
        }

        actions.appendChild(makeButton("Edit", "edit_btn", function() {
            startEdit(task.id);
        }));
        actions.appendChild(makeButton("Delete", "delete_btn", function() {
            deleteTask(task.id);
        }));
    }

    const tags = document.createElement("div");
    tags.className = "task_tags";

    const importanceTag = document.createElement("span");
    importanceTag.className = "importance_tag";
    importanceTag.textContent = task.importance;
    tags.appendChild(importanceTag);

    if (task.id === doingNowId) {
        const doingTag = document.createElement("span");
        doingTag.className = "doing_tag";
        doingTag.textContent = "Doing Now";
        tags.appendChild(doingTag);
    }

    info.appendChild(tags);

    li.appendChild(checkbox);
    li.appendChild(info);
    li.appendChild(actions);
    return li;
}

function renderTasks() {
    taskList.innerHTML = "";
    const sorted = getSortedTasks();

    emptyMsg.style.display = sorted.length === 0 ? "block" : "none";

    sorted.forEach(function(task) {
        taskList.appendChild(createTaskItem(task));
    });

    const editInput = taskList.querySelector(".edit_input");
    if (editInput) {
        editInput.focus();
    }

    updateTimerPanel();
}

function updateTimerPanel() {
    const task = findTask(doingNowId);
    const running = timerId !== null;

    doingNowTitle.textContent = task ? task.title : "No task selected";
    timerDisplay.textContent = formatTime(remaining);
    startBtn.disabled = !task || running || promptOpen;
    resetBtn.disabled = !task;
    clearBtn.disabled = !task;
    durationSelect.disabled = running;
}

addForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const title = taskInput.value.trim();

    if (title === "") {
        errorMsg.textContent = "Please enter a task title before adding.";
        taskInput.focus();
        return;
    }

    tasks.push({
        id: nextId++,
        title: title,
        importance: importanceSelect.value,
        completed: false,
        order: orderCount++
    });

    errorMsg.textContent = "";
    taskInput.value = "";
    importanceSelect.value = "Low";
    renderTasks();
});

taskInput.addEventListener("input", function() {
    errorMsg.textContent = "";
});

function startEdit(id) {
    if (promptOpen) {
        return;
    }
    editingId = id;
    listError.textContent = "";
    renderTasks();
}

function saveEdit(id, value) {
    const title = value.trim();

    if (title === "") {
        listError.textContent = "A task title can't be empty.";
        return;
    }

    findTask(id).title = title;
    editingId = null;
    listError.textContent = "";
    renderTasks();
}

function cancelEdit() {
    editingId = null;
    listError.textContent = "";
    renderTasks();
}

function deleteTask(id) {
    if (promptOpen) {
        return;
    }
    if (id === doingNowId) {
        clearDoingNow();
    }
    if (id === editingId) {
        editingId = null;
    }

    tasks = tasks.filter(function(task) {
        return task.id !== id;
    });
    renderTasks();
}

function toggleComplete(id, checked) {
    if (promptOpen) {
        renderTasks();
        return;
    }

    const task = findTask(id);
    task.completed = checked;
    task.order = orderCount++;

    if (checked && id === doingNowId) {
        clearDoingNow();
    }
    renderTasks();
}

function changeImportance(id, value) {
    const task = findTask(id);

    if (task.importance === value) {
        return;
    }

    task.importance = value;
    if (!task.completed) {
        task.order = orderCount++;
    }
    renderTasks();
}

function stopTimer() {
    if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
    }
}

function resetTimer() {
    stopTimer();
    remaining = getDuration();
    updateTimerPanel();
}

function setDoingNow(id) {
    if (promptOpen) {
        return;
    }
    doingNowId = id;
    resetTimer();
    renderTasks();
}

function clearDoingNow() {
    doingNowId = null;
    resetTimer();
}

function tick() {
    remaining--;

    if (remaining <= 0) {
        remaining = 0;
        stopTimer();
        openPrompt();
        return;
    }
    updateTimerPanel();
}

function openPrompt() {
    promptOpen = true;
    modalTaskTitle.textContent = findTask(doingNowId).title;
    modalOverlay.classList.remove("hidden");
    updateTimerPanel();
    yesBtn.focus();
}

function closePrompt() {
    promptOpen = false;
    modalOverlay.classList.add("hidden");
}

startBtn.addEventListener("click", function() {
    if (timerId !== null || doingNowId === null || promptOpen) {
        return;
    }
    timerId = setInterval(tick, 1000);
    updateTimerPanel();
});

resetBtn.addEventListener("click", function() {
    resetTimer();
});

clearBtn.addEventListener("click", function() {
    clearDoingNow();
    renderTasks();
});

durationSelect.addEventListener("change", function() {
    if (timerId === null) {
        remaining = getDuration();
        updateTimerPanel();
    }
});

yesBtn.addEventListener("click", function() {
    const task = findTask(doingNowId);
    closePrompt();

    if (task) {
        task.completed = true;
        task.order = orderCount++;
    }

    clearDoingNow();
    renderTasks();
});

noBtn.addEventListener("click", function() {
    closePrompt();
    resetTimer();
    renderTasks();
});

showGreeting();
renderTasks();