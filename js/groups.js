document.addEventListener("DOMContentLoaded", () => {
    fetchGroups();
});

//Lets fetch the JSON data from the PHP backend
function fetchGroups() {
    fetch("getGroups.php")
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then(data => {
            if (data.length > 0) {
                renderTable(data);
            } else {
                document.querySelector(".container").innerHTML += "<p>No data found.</p>";
            }
        })
        .catch(error => {
            console.error("There was a problem fetching the group data:", error);
        });
}

function renderTable(data) {
    const tableHeaders = document.getElementById("table-headers");
    const tableBody = document.getElementById("table-body");

    //Create Headers dynamically based on the keys of the first item
    const headers = Object.keys(data[0]);
    
    headers.forEach(key => {
        let th = document.createElement("th");
        th.innerText = key; //Ex: "Email Address", "Group"
        tableHeaders.appendChild(th);
    });

    //Create Rows of data
    data.forEach(rowData => {
        let tr = document.createElement("tr");

        headers.forEach(key => {
            let td = document.createElement("td");
            td.innerText = rowData[key];
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}
