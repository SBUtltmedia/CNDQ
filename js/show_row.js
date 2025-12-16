const urlParams = new URLSearchParams(window.location.search);

let rowId = parseInt(urlParams.get('rowId') || 1)+1;
let approvalId = parseInt(urlParams.get('approvalId')) || 0;
let sheetId = urlParams.get('sheetId') || "";


let queryString = "";

urlParams.forEach((value, key) => {
    queryString+= `${key}=${value}&`;
});




let landingPage = document.getElementById("landing-page");



document.addEventListener("DOMContentLoaded", () => init());



function init() {
    fetch(`get_cell.php?${queryString}`)
        .then(response => response.json())
        .then(({ approval_status }) => {
            if (["Yes", "No"].includes(approval_status?.trim())) {
                let isApproved = approval_status==="Yes";
                displayApprovalMessage(isApproved);
                return;
            }
            return fetch(`get_row.php?${queryString}`)
                .then(response => response.json())
                .then(data => {
                        displayData(data);
                });
        })
        .catch(error => console.error(error));
}

function displayData(data) {

    let detailsContainer = document.getElementById("details-request");

    let dataContainer = document.getElementById("data-container") || {};
    dataContainer.innerHTML = "";

    let headerDiv = document.createElement("div");
    headerDiv.id = "header";

    let header = document.createElement("h2");
    header.innerText = "APPROVAL REQUEST";

    headerDiv.appendChild(header);
    dataContainer.prepend(headerDiv);

    delete data["Form Processed"];


    let approverValKeys = Object.keys(data).filter((key) => {
        return key.toLowerCase().includes("approval")
    })

    let approvalStatusMap = approverValKeys.map(key => {
        let approverVal = data[key] ? data[key].toLowerCase() : "";
        return approverVal === "yes" ? " has Approved" :
               approverVal === "no" ? " didn't Approve" :
               " yet to Approve";
    });

    let emailCount = 0;

    Object.keys(data).filter((key) => {
        return key.toLowerCase().includes("email address")
    }).forEach((key,index) => {
        emailCount++;
        if (emailCount > 1) { // Only process if it's the second or subsequent email address
            approverVal = approvalStatusMap[index-1];
            data[key]+=approverVal;

        delete data[approverValKeys[index-1]];
        }
    })

    Object.keys(data).forEach((item) => {
        let row = document.createElement("div");
        row.classList.add("data-row");

        let label = document.createElement("div");
        label.classList.add("label");

        let displayKey = item.trim();
        displayKey = displayKey.replace(/\s~[0-9]+$/, '');

        label.innerText = displayKey.endsWith(":") ? displayKey : displayKey + ":";

        // label.innerText = item.trim().endsWith(":") ? item.trim() : item.trim() + ":";

        let value = document.createElement("div");
        value.classList.add("value");
        value.innerText = data[item];

        row.appendChild(label);
        row.appendChild(value);
        dataContainer.appendChild(row);
    })

    detailsContainer.appendChild(dataContainer);
    landingPage.append(detailsContainer);


    setupApprovalButtons();
}

function setupApprovalButtons() {
    let approveDiv = document.getElementById("approval-section");
    approveDiv.innerHTML = `<br><strong>Do you want to approve?</strong><br>`;

    ["Yes", "No"].forEach(text => {
        let button = document.createElement("button");
        button.innerText = text;
        // let value = (text == "Yes");
        button.classList.add(text.toLowerCase());
        button.onclick = () => handleApprovalDecision(text);
        approveDiv.appendChild(button);
    });

    landingPage.appendChild(approveDiv);
}

function handleApprovalDecision(approval_status) {
    let isApproved = approval_status==="Yes";


    //pass the approval id number to form "Approval 1/2/3" in update_yes_no.php

    fetch(`update_yes_no.php?sheetId=${sheetId}&rowId=${rowId-1}&approvalId=${approvalId}&approval_status=${approval_status}`)
        .then(() => displayApprovalMessage(isApproved));
}


function displayApprovalMessage(isApproved) {
    document.body.innerHTML = "";

    let messageContainer = document.createElement("div");
    messageContainer.classList.add("message-container");

    let message = document.createElement("div");
    message.classList.add("message");
    message.innerText = isApproved ? "Your approval has been submitted ✅" : "Your rejection has been submitted ❌";

    messageContainer.appendChild(message);
    document.body.appendChild(messageContainer);
}
