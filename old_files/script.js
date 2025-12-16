var gameVars;
var lastStats = [];
var role;
var stats = {
    "Strength": 0,
    "Wisdom": 0,
    "Loyalty": 0
}


$(document).ready(function () {

    var isOnline = new RegExp('apps\.tlt\.stonybrook\.edu').test(window.location.href);

    if (isOnline) {
        online();

    } else {
        offline();

    }

});

function getVar(tvar) {
    return SugarCube.State.getVar(tvar);
}

function offline() {
    var vars = window.gameData;

    for (key in vars) {

        SugarCube.State.setVar("$" + key, vars[key]);
    }


    SugarCube.Engine.play(vars["currentPassage"])
    fade($("body"), 1);
}


function online() {

    if (email == "") {
        //   window.location = "login"

    }
    $.get("roles.php", loadRole);

}


$(document).on(':passageinit', function (ev) {
    checkDif();
});

function init() {
    // $('#passages').html($('#passages').html().replace(/<br><br>/gm, ""));
    $("body").on("click", () => {
        $("body").addClass("blur")

    });
    fade($("body"), 1);
   setInterval(checkDif, 500)

}

function goto(url = "http://www.stonybrook.edu") {
    window.open(url, '_blank').focus();
}

function setBackground(image) {
    image = image || "paper.jpg"

    var faction = SugarCube.State.getVar('$faction')

    $(() => {
        $('#story').css({

            'background-image': `url('https://apps.tlt.stonybrook.edu/Aztec/master/images/Borders/${faction}.jpg'),url('images/${image}')`,
            'background-position': '30% 70%,0 0',
            'background-size': '100% 100%'
        })

    })
}

function fade(el, destination) {


    $({
            opacity: 1 - destination
        })
        .animate({
            opacity: destination
        }, {
            duration: 2000,
            step: function () {
                $(el).css({
                    opacity: this.opacity
                })
            }
        });



}

$(document).on(':passagestart', (ev) => {





    var role = SugarCube.State.getVar("$role");

    var passage = $(ev.content).data("passage");
    var passageLength = Math.sqrt(SugarCube.Story.get(passage).text.length);
    var fs = `${Math.log(passageLength)}rem`;
    
    //$('#passages').css({"font-size":fs})
    var dif={}
    dif[`${role}_currentPassage`]= passage;
    $.post("updateBatch.php", dif);
    //setCurrentPassage(passage)
    //SugarCube.State.setVar(`$${role}_currentPassage`, );
    fade($("#passages"), 1);








})

function setCurrentPassage(passage){

    SugarCube.State.setVar(`$${role}_currentPassage`,passage );

}
/* JavaScript code */

function changeStats(rolePlay,newStats){

    $.get("gameState.php", (data) => {
        var getVars = getGameData(data);
    var dif={}
    Object.keys(stats).forEach((stat, idx) => {
 
        var key= `${rolePlay}_${stat}`;
        var oldVal =  getVars[`${key}`];
        console.log(oldVal,stat,newStats[stat])
        dif[key]=oldVal+newStats[stat];
    
    });
    console.log(dif)
    $.post("updateBatch.php", dif);
});

}


function checkDif() {
    var dif = {};
    var deleteVars = ["role", "faction", "roles", "roleInfo", "isLeader", "character"]
    var partialVars=["currentPassage","_ctr","_sum",...Object.keys(stats)]
    var sugarVars = Object.assign({}, SugarCube.State.variables);
    deleteVars.forEach((item) => delete sugarVars[item])


    for (i in sugarVars) {
       // console.log(i)
        var noPartial = true;
        partialVars.forEach((part)=> {
            if(i.includes(part) && !i.includes(role)) {
                noPartial=false
        //    console.log(stat,notStat)
            }
        });
        var sugJson=JSON.stringify(sugarVars[i]);
        var gameJson=JSON.stringify(gameVars[i]);
        if (sugJson != gameJson  && !i.includes("currentPassage") && noPartial ) {
            dif[i] = JSON.stringify(sugarVars[i]);
        

        }
    }
    gameVars = Object.assign({}, sugarVars);

    if (!$.isEmptyObject(dif)) {
        
        $.post("updateBatch.php", dif);


    }
 
}

function showMap() {
    var map = $('#map')
    if (!map.length) {
        $('#story').append($('<img/>', {
            "id": "map",
            "name": "map"
        }))
    }


    var faction = SugarCube.State.getVar("$faction");
    var currentMap = 1 && SugarCube.State.getVar(`$${faction}_currentMap`);
    var showMap = $('#map').data("currentMap")

    if (showMap != currentMap) {
        
        SugarCube.State.setVar(`$${faction}_currentMap`, currentMap);
        $('#map').attr("src", `images/${faction}_${currentMap}.png`)
        $('#map').data("currentMap", currentMap)
    }
}

function showStats() {
    var showStats = false;
    var statString = "";
  
    var faction = SugarCube.State.getVar("$faction");


    var displayStats = $('<div/>', {
        "id": "displayStats",

    })
    Object.keys(stats).forEach((stat, idx) => {
        var twineVar = SugarCube.State.getVar(`$${role}_${stat}`);
        statString += `${stat}: ${twineVar||"0"} `;
        
        if (lastStats[idx] != twineVar) {
            showStats = true;

        }
        lastStats[idx] = twineVar;
        displayStats.append(
            $('<div/>', {
                "class": "stat",
                "css": {
                    "background-image": `url(images/${faction}_${stat}.png`
                }
            }).append($('<div/>', {
                "class": "statNum",
                "html": twineVar || "0"
            })))

    })
    var dispLayStatsDOM = $('#displayStats')
    if (showStats) {
        if (!dispLayStatsDOM.length) {
            $('#story').append(displayStats)
        } else {
            dispLayStatsDOM.replaceWith(displayStats)
        }
    }
    var twineVar = SugarCube.State.getVar(`$${faction}_strength`);
    if (twineVar) {
        statString = `${faction} Strength: ${twineVar} `;
        if (!$('#factionStrength').length) {
            $('#story').append($('<div/>', {
                    "id": "factionStrength",

                }).append(
                    $('<div/>', {
                        "id": "factionStrengthBar",
                        // "html": statString
                    })

                )


            ).append($('<div/>', {
                "id": "factionStrengthLabel",
                "html": statString
            }))
        }
        setFactionStrength(twineVar)
    }




}

function setFactionStrength(rawValue) {
    var maxValue = 14;
    var value = rawValue / maxValue * 100;
    var gradientMask = `linear-gradient(90deg, black 0%, black ${value}%, transparent ${Math.min(100,value+10)}%)`
    $("#factionStrengthBar").css({
        "-webkit-mask-image": gradientMask,
        "mask-image": gradientMask
    })
}

function makeRoleStats(statsIn) {

    var total = 0;
    // var role = SugarCube.State.getVar("$role");
    var output = "";


    
    Object.keys(statsIn).forEach((stat) => {
        var twineVar = `$${role}_${stat}`


        val = parseInt(statsIn[stat]);


        SugarCube.State.setVar(twineVar, val);
        output += `${stat}: ${val}\n`
    })




    $('#statsPicker').html(output)



    // return output;
    showStats()
}

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

function loadRole(data) {

    //  var email = SugarCube.State.getVar("$email");
    var roles = $.csv.toObjects(data);

    role = "Player"
    var foundRole = roles.find((item) => item.email == email)

    if (foundRole) {
        role = foundRole.role

    }
    // SugarCube.State.setVar("$roles", roles);
    SugarCube.State.setVar("$role", role);

    $.get("roleInfo.php", (data) => loadRoleInfo(data, role))


}

function loadRoleInfo(data, role) {
    var roleInfo = $.csv.toObjects(data);
    var faction = "Observer";
    var isLeader = false;
    var character = "Observer"
    var foundRoleInfo = roleInfo.find((item) => item.Role.toLowerCase() == role.toLowerCase())
    if (foundRoleInfo) {

        faction = foundRoleInfo.Faction;
        isLeader = foundRoleInfo.isLeader.toLowerCase();
        character = foundRoleInfo.Character

    }

    SugarCube.State.setVar("$roleInfo", roleInfo);
    SugarCube.State.setVar("$faction", faction);
    SugarCube.State.setVar("$isLeader", isLeader);
    SugarCube.State.setVar("$character", character);
    $.get("gameState.php", loadGameData);


}

function getGameData(data) {
    var returnVars = {}
    gameVars = $.csv.toObjects(data)[0];

    for (key in gameVars) {
        var val = parseInt(gameVars[key]);
        if (!val) {
            val = gameVars[key]
        }

        try {
            val = JSON.parse(val);

        } catch {}
        returnVars[key] = val || 0;

    }
    
    return returnVars;
}

function loadGameData(data) {

    var getVars = getGameData(data);
    for (const [key, val] of Object.entries(getVars)) {
        SugarCube.State.setVar("$" + key, val || 0);
    }

    var role = SugarCube.State.getVar("$role");
    var currentPassage = SugarCube.State.getVar(`$${role}_currentPassage`) || getVars["currentPassage"];

    SugarCube.Engine.play(currentPassage)
    init();

}



function counter(value,...names){
    if(SugarCube.State.getVar("$faction")=="God") return;
    var dif={}
    $.get("gameState.php", (data) => {
        var getVars = getGameData(data);
        if(isNaN(value)){
            value = getVars[value] || 0;
        }
        names.forEach((name) => {
            var countVar = getVars[`${name}_ctr`] || []
            if(!Array.isArray(countVar)) countVar=[];
            var currentUser = countVar.find((a)=>Object.keys(a)[0]==role) 
            if(currentUser){currentUser[role]=currentUser[role]+value}
            else {
                var newObj={}
                newObj[role]=value;
                countVar.push(newObj);
            }
            // const reducer2 = (prev,cur)=>prev+Object.values(cur)[0];
            // Object.values(array1).reduce(reducer2,0)
            var reducer= (prev,cur)=>prev+Object.values(cur)[0];
            var sum = Object.values(countVar).reduce(reducer,0);
            SugarCube.State.setVar(`$${name}_ctr`, countVar);
            SugarCube.State.setVar(`$${name}_sum`, sum);
            dif[`${name}_ctr`]=JSON.stringify(countVar);
            dif[`${name}_sum`]=sum;
         console.log(dif)
        })
        $.post("updateBatch.php", dif);
    });
}


function counter2(value,...names){
    $.get("gameState.php", (data) => {
        var getVars = getGameData(data);
        if(isNaN(value)){
            value = getVars[value] || 0;
        }
        names.forEach((name) => {
            var countVar = getVars[name] || []
            if(!Array.isArray(countVar)) countVar=[];
            var currentUser = countVar.find((a)=>Object.keys(a)[0]==role) 
            if(currentUser){currentUser[role]=currentUser[role]+value}
            else {
                var newObj={}
                newObj[role]=value;
                countVar.push(newObj);
            }
            // const reducer2 = (prev,cur)=>prev+Object.values(cur)[0];
            // Object.values(array1).reduce(reducer2,0)
            var reducer= (prev,cur)=>prev+Object.values(cur)[0];
            var sum = Object.values(countVar).reduce(reducer,0);
            SugarCube.State.setVar(`$${name}`, countVar);
            SugarCube.State.setVar(`$${name}_sum`, sum);
         
        })
        checkDif();  
    });
}

function showCounterRoles(twineVar){
    var display =$("<span/>", {
        "id": `${twineVar}_display`
    })

setInterval(update,2000);
    function update(){
        $.get("gameState.php", (data) => {
            var getVars = getGameData(data);
            var roles=getVars[twineVar].map((item)=>Object.keys(item)[0]).join(" ");
          $(`#${twineVar}_display`).html(roles);  
          
        });


    }
return display;
}

function vote(voteName, ...labels) {
   if(!SugarCube.State.getVar(`$${voteName}`))
   {
    SugarCube.State.setVar(`$${voteName}`, {});
    checkDif();
   }
    var out = []
    labels.forEach((label) => {
        var id = `${voteName}_${label}`;
        out.push($("<button/>", {
            "id": id,
            "html": label,
            "class": voteName
        }).on("click", voteEvent));

    })

    function voteEvent(evt) {
        var id = [clickedName, clickedLabel] = $(this).attr("id").split("_")
        $.get("gameState.php", (data) => {
            var getVars = getGameData(data);
            var voteVar = getVars[clickedName] || {}
            labels.forEach((label) => {
                if (label == clickedLabel) {
                    var operation = "add"
                    var newEntry = [role]
                } else {
                    var operation = "delete"
                    var newEntry = []
                   $(`#${voteName}_${label}`).prop("disabled", true);
                }
                if (label in voteVar) {
                    var set = new Set(voteVar[label])
                    set[operation](role)
                    voteVar[label] = [...set];
                } else {
                    voteVar[label] = newEntry;
                }
            })
            
            SugarCube.State.setVar(`$${clickedName}`, voteVar);
         checkDif();
        })
    }
    return out;
}
