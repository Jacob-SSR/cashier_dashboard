<?php
	session_start();
	include('includes/config.php');
?>
<!doctype html>
<html lang="en">
    <head>
        <!-- Required meta tags -->
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <!-- Bootstrap CSS -->
        <link rel="stylesheet" href="./assets/css/bootstrap-dark.css">
        <link rel="stylesheet" href="./assets/css/style.css">
        <title>Queue Monitor</title>
        <style>
            @font-face {
                font-family: mirt;
                src: url("assets/font/Mitr-Regular.ttf");
            }
            @font-face {
                font-family: kanit;
                src: url("assets/font/Kanit-Regular.ttf");
                
            }
            
            .headerDisplay {
                font-family: mirt;
                font-size: 35px;
                text-align: center;
                min-width: 50%;
                max-width: 50%;
                color: #a6cde6;
            }
            

            .wellcomDisplay {
                font-family: mirt;
                font-size: 25px;
                background-image: linear-gradient(to right, #8aacc7 0%, #c2e9fb 51%, #8aacc7 100%);
                min-width: 43%;
                max-width: 43%;
                border-radius: 25px;
                text-align:center;
                /*color: #919292;*/
                color: #191970;
                border: 6px solid rgba(255,255,255,0.45);
            }

            .headerWaitingQueue{
                font-family: mirt;
                font-size:30px;
                background-image: linear-gradient(to right, #8aacc7 0%,  #8aacc7 100%);
                border-radius: 5px 5px 0px 0px;
                border: 5px solid rgba(255,255,255,0.45);
                color:white;
                text-align:center;
            }
            .headerCallQueue{
                font-family: mirt;
                background-image: linear-gradient(to right, #8aacc7 0%,  #8aacc7 100%);
                color:#8aacc7;
                text-align:center;
            }
            .headerCol{
                font-family: mirt;
                font-size:20px;
                background-image: linear-gradient(to right, #f6f5f5 0%,  #f6f5f5 100%);
                text-align:center;
            }
            .bodyCol{
                font-family: mirt;
                font-size:20px;
                background-image: linear-gradient(to right, #8aacc7 0%,  #8aacc7 100%);
                text-align:center;
            }
            .bg {
                /* Center and scale the image nicely */
                /*background-image: linear-gradient(white, DeepSkyBlue);*/
                background-color:#fcfdff;
            }
            .parent {
                /*margin: 1rem;*/
                text-align:center;
            }
            .child {
                /*border: 1px red solid;*/
                display: inline-block;
                vertical-align: top;
            }

        </style>
    </head>
    <body style="width: 98%;" class="bg">
        <main role="main">
            <div class="parent">
                <div class="child headerDisplay">
                ห้องเก็บเงิน/ห้องจ่ายยา
                </div>
                <div class="child wellcomDisplay">โรงพยาบาลพลับพลาชัย จังหวัดบุรีรัมย์</div>
            </div>
            <div class="parent"> 
            <div class="child" style="width:48%;text-align:center;">
                    <table style="width:100%;">
                        <tr>
                            <th class="headerWaitingQueue" colspan="5">ห้องเก็บเงิน</th>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="5">เรียกคิว</td>
                        </tr>
                        <tr style="border-top: 1px solid black;">
                            
                            <td class="headerCol" colspan="3" style="width:60%;">ชื่อผู้รับบริการ</td>
                            <td class="headerCol" colspan="2" style="width:40%;">จุดบริการ</td>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="3"  id="callingQueueMoneyFullName1"></td>
                            <td class="headerCol" colspan="2" id="callingQueueMoneyDepartment1"></td>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="3"  id="callingQueueMoneyFullName2"></td>
                            <td class="headerCol" colspan="2" id="callingQueueMoneyDepartment2"></td>
                        </tr>
                        <tr>
                            <th class="headerCallQueue" colspan="5">.</th>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="5">คิวรอ</td>
                        </tr>
                        <tr style="border-top: 1px solid black;">
                            <td class="headerCol" style="width:10%;">ที่</td>
                            <td class="headerCol"  style="width:15%;">คิว</td>
                            <td class="headerCol"  style="width:45%;">ชื่อผู้รับบริการ</td>
                            <td class="headerCol" style="width:20%;">เวลารอ</td>
                            <td class="headerCol" style="width:10%;"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">1</td>
                            <td class="bodyCol" id="queueMoneyNumber1"></td>
                            <td class="bodyCol" id="queueMoneyFullName1"></td>
                            <td class="bodyCol" id="queueMoneyWaitingTime1"></td>
                            <td class="bodyCol" id="queueMoneyPriority1"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">2</td>
                            <td class="bodyCol" id="queueMoneyNumber2"></td>
                            <td class="bodyCol" id="queueMoneyFullName2"></td>
                            <td class="bodyCol" id="queueMoneyWaitingTime2"></td>
                            <td class="bodyCol" id="queueMoneyPriority2"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">3</td>
                            <td class="bodyCol" id="queueMoneyNumber3"></td>
                            <td class="bodyCol" id="queueMoneyFullName3"></td>
                            <td class="bodyCol" id="queueMoneyWaitingTime3"></td>
                            <td class="bodyCol" id="queueMoneyPriority3"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">4</td>
                            <td class="bodyCol" id="queueMoneyNumber4"></td>
                            <td class="bodyCol" id="queueMoneyFullName4"></td>
                            <td class="bodyCol" id="queueMoneyWaitingTime4"></td>
                            <td class="bodyCol" id="queueMoneyPriority4"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">5</td>
                            <td class="bodyCol" id="queueMoneyNumber5"></td>
                            <td class="bodyCol" id="queueMoneyFullName5"></td>
                            <td class="bodyCol" id="queueMoneyWaitingTime5"></td>
                            <td class="bodyCol" id="queueMoneyPriority5"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">6</td>
                            <td class="bodyCol" id="queueMoneyNumber6"></td>
                            <td class="bodyCol" id="queueMoneyFullName6"></td>
                            <td class="bodyCol" id="queueMoneyWaitingTime6"></td>
                            <td class="bodyCol" id="queueMoneyPriority6"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">7</td>
                            <td class="bodyCol" id="queueMoneyNumber7"></td>
                            <td class="bodyCol" id="queueMoneyFullName7"></td>
                            <td class="bodyCol" id="queueMoneyWaitingTime7"></td>
                            <td class="bodyCol" id="queueMoneyPriority7"></td>
                        </tr>
                    </table>
                </div>
                <div class="child" style="width:50%;text-align:center;">
                    <table style="width:100%;">
                        <tr>
                            <th class="headerWaitingQueue" colspan="5">ห้องจ่ายยา</th>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="5">เรียกคิว</td>
                        </tr>
                        <tr style="border-top: 1px solid black;">
                            <td class="headerCol"  colspan="3" style="width:60%;">ชื่อผู้รับบริการ</td>
                            <td class="headerCol" colspan="2" style="width:40%;">จุดบริการ</td>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="3" id="callingQueueDrugFullName1"></td>
                            <td class="headerCol" colspan="2" id="callingQueueDrugDepartment1"></td>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="3" id="callingQueueDrugFullName2"></td>
                            <td class="headerCol" colspan="2" id="callingQueueDrugDepartment2"></td>
                        </tr>
                        
                        <tr>
                            <th class="headerCallQueue" colspan="5">.</th>
                        </tr>
                        <tr>
                            <td class="headerCol" colspan="5">คิวรอ</td>
                        </tr>
                        <tr style="border-top: 1px solid black;">
                            <td class="headerCol" style="width:10%;">ที่</td>
                            <td class="headerCol"  style="width:15%;">คิว</td>
                            <td class="headerCol"  style="width:45%;">ชื่อผู้รับบริการ</td>
                            <td class="headerCol" style="width:20%;">เวลารอ</td>
                            <td class="headerCol" style="width:10%;"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">1</td>
                            <td class="bodyCol" id="queueDrugNumber1"></td>
                            <td class="bodyCol" id="queueDrugFullName1"></td>
                            <td class="bodyCol" id="queueDrugWaitingTime1"></td>
                            <td class="bodyCol" id="queueDrugPriority1"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">2</td>
                            <td class="bodyCol" id="queueDrugNumber2"></td>
                            <td class="bodyCol" id="queueDrugFullName2"></td>
                            <td class="bodyCol" id="queueDrugWaitingTime2"></td>
                            <td class="bodyCol" id="queueDrugPriority2"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">3</td>
                            <td class="bodyCol" id="queueDrugNumber3"></td>
                            <td class="bodyCol" id="queueDrugFullName3"></td>
                            <td class="bodyCol" id="queueDrugWaitingTime3"></td>
                            <td class="bodyCol" id="queueDrugPriority3"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">4</td>
                            <td class="bodyCol" id="queueDrugNumber4"></td>
                            <td class="bodyCol" id="queueDrugFullName4"></td>
                            <td class="bodyCol" id="queueDrugWaitingTime4"></td>
                            <td class="bodyCol" id="queueDrugPriority4"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">5</td>
                            <td class="bodyCol" id="queueDrugNumber5"></td>
                            <td class="bodyCol" id="queueDrugFullName5"></td>
                            <td class="bodyCol" id="queueDrugWaitingTime5"></td>
                            <td class="bodyCol" id="queueDrugPriority5"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">6</td>
                            <td class="bodyCol" id="queueDrugNumber6"></td>
                            <td class="bodyCol" id="queueDrugFullName6"></td>
                            <td class="bodyCol" id="queueDrugWaitingTime6"></td>
                            <td class="bodyCol" id="queueDrugPriority6"></td>
                        </tr>
                        <tr>
                            <td class="bodyCol">7</td>
                            <td class="bodyCol" id="queueDrugNumber7"></td>
                            <td class="bodyCol" id="queueDrugFullName7"></td>
                            <td class="bodyCol" id="queueDrugWaitingTime7"></td>
                            <td class="bodyCol" id="queueDrugPriority7"></td>
                        </tr>
                    </table>
                </div>
                
            </div>
            <div id="audioPlaying"></div>
            <div id="audioDrugPlaying"></div>
        </div>
    </body>
    <script src="./assets/js/libs/jquery.js"></script>
    <script src="./assets/js/libs/popper.js"></script>
    <script src="./assets/js/libs/bootstrap.min.js"></script>
    <script src="./assets/js/libs/howler.js"></script>
    <script src="./assets/js/libs/moment.js"></script>
    <script src="./assets/js/libs/lodash.js"></script>
    <script src="./assets/js/libs/mqtt.js"></script>
    <script src="./assets/js/libs/jquery.marquee.min.js"></script>
    <script src="./assets/js/libs/axios.js"></script>
    <script src="./assets/js/libs/jwt-decoded.js"></script>
    <script src="./assets/js/config.js"></script>
    <script>
        $( document ).ready(function() {
            setInterval(function() {getCurentVisit("'013','077','078'",7);}, 3000);
            setInterval(function() {getCurentQueue("'013','077','078'",2);}, 3000);
            setInterval(function() {getCurentVisitDrug("'008','060','061'",7);}, 3000);
            setInterval(function() {getCurentQueueDrug("'008','060','061'",2);}, 3000);
        });

        function getCurentVisit(depcode,limit) {
            jQuery.ajax({
                url:'ajax/getScreeningW.php',
                type:'post',
                data:'depcode='+depcode+"&limit="+limit,
                success:function(result){
                    result = JSON.parse(result);
                    _setCurrentList(result,limit)
                }
            });
        }
        function getCurentVisitDrug(depcode,limit) {
            jQuery.ajax({
                url:'ajax/getScreeningW.php',
                type:'post',
                data:'depcode='+depcode+"&limit="+limit,
                success:function(result){
                    result = JSON.parse(result);
                    _setCurrentListDrug(result,limit)
                }
            });
        }

        function _setCurrentList(items,rowLength){
            if(items.length){
                for (let i = 1; i <= rowLength; i++) {
                    if(i<=items.length){
                        let _timePerCase = 180;
                        let _ttime = Math.floor((_timePerCase*(i))/60);
                        let _minute = (_timePerCase*(i))%60;
                        let _background;
                        if (items[i-1].pt_priority == 0){
                            _background = '<div style="background-color: white;color:white;min-width:50%;">xxx</div>';
                        }else if (items[i-1].pt_priority == 1){
                            _background = '<div style="background-color: green;color:green;">xxx</div>';
                        }else if (items[i-1].pt_priority == 2){
                            _background = '<div style="background-color: yellow;color:yellow;">xxx</div>';
                        }else if (items[i-1].pt_priority == 3){
                            _background = '<div style="background-color:pink;color:pink;">xxx</div>';
                        }else if (items[i-1].pt_priority == 4){
                            _background = '<div style="background-color:red;color:red;">xxx</div>';
                        }
                        jQuery('#queueMoneyNumber'+i).html(items[i-1].oqueue)
                        jQuery('#queueMoneyFullName'+i).html(items[i-1].full_name)
                        jQuery('#queueMoneyWaitingTime'+i).html(_ttime);
                        jQuery('#queueMoneyPriority'+i).html(_background)
                    }else{
                        jQuery('#queueMoneyNumber'+i).html("")
                        jQuery('#queueMoneyFullName'+i).html("")
                        jQuery('#queueMoneyWaitingTime'+i).html("")
                        jQuery('#queueMoneyPriority'+i).html("")
                    }
                }
            }else{
                for (let i = 1; i <= rowLength; i++) {
                    jQuery('#queueMoneyNumber'+i).html("")
                    jQuery('#queueMoneyFullName'+i).html("")
                    jQuery('#queueMoneyWaitingTime'+i).html("")
                    jQuery('#queueMoneyPriority'+i).html("")
                }
            }
        }

        function _setCurrentListDrug(items,rowLength){
            if(items.length){
                for (let i = 1; i <= rowLength; i++) {
                    if(i<=items.length){
                        let _timePerCase = 180;
                        let _ttime = Math.floor((_timePerCase*(i))/60);
                        let _minute = (_timePerCase*(i))%60;
                        let _background;
                        if (items[i-1].pt_priority == 0){
                            _background = '<div style="background-color: white;color:white;min-width:50%;">xxx</div>';
                        }else if (items[i-1].pt_priority == 1){
                            _background = '<div style="background-color: green;color:green;">xxx</div>';
                        }else if (items[i-1].pt_priority == 2){
                            _background = '<div style="background-color: yellow;color:yellow;">xxx</div>';
                        }else if (items[i-1].pt_priority == 3){
                            _background = '<div style="background-color:pink;color:pink;">xxx</div>';
                        }else if (items[i-1].pt_priority == 4){
                            _background = '<div style="background-color:red;color:red;">xxx</div>';
                        }
                        jQuery('#queueDrugNumber'+i).html(items[i-1].oqueue)
                        jQuery('#queueDrugFullName'+i).html(items[i-1].full_name)
                        jQuery('#queueDrugWaitingTime'+i).html(_ttime);
                        jQuery('#queueDrugPriority'+i).html(_background)
                    }else{
                        jQuery('#queueDrugNumber'+i).html("")
                        jQuery('#queueDrugFullName'+i).html("")
                        jQuery('#queueDrugWaitingTime'+i).html("")
                        jQuery('#queueDrugPriority'+i).html("")
                    }
                }
            }else{
                for (let i = 1; i <= rowLength; i++) {
                    jQuery('#queueMoneyNumber'+i).html("")
                    jQuery('#queueMoneyFullName'+i).html("")
                    jQuery('#queueMoneyWaitingTime'+i).html("")
                    jQuery('#queueMoneyPriority'+i).html("")
                }
            }
        }
            
        function getCurentQueue(depcode,limit) {
            jQuery.ajax({
                url:'ajax/getDoctorRoomQ.php',
                type:'post',
                async: false,
                data:'depcode='+depcode+'&limit='+limit,
                success:function(result){
                    result = JSON.parse(result);
                    _setCurrentQueueList(result['queues'],limit);
                    if(result['audio']!==""){
                        jQuery('#audioPlaying').html(result['audio'])
                        if(result['audio'] !==""){
                            jQuery('#audioPlaying').play();
                        }
                    }
                }
            });
        }

        function getCurentQueueDrug(depcode,limit) {
            jQuery.ajax({
                url:'ajax/getMedicineQ.php',
                type:'post',
                async: false,
                data:'depcode='+depcode+'&limit='+limit,
                success:function(result){
                    result = JSON.parse(result);
                    _setCurrentQueueListDrug(result['queues'],limit);
                    if(result['audio']!==""){
                        jQuery('#audioDrugPlaying').html(result['audio'])
                        if(result['audio'] !==""){
                            jQuery('#audioDrugPlaying').play();
                        }
                    }
                }
            });
        }
            
        function _setCurrentQueueList(items,limit) {
            if(items.length){
                for (let i = 1; i <= limit; i++) {
                    if(i<=items.length){
                        let _background;
                        if (items[i-1].pt_priority == 0){
                            _background = '<div style="background-color: white;color:white;min-width:50%;">xxx</div>';
                        }else if (items[i-1].pt_priority == 1){
                            _background = '<div style="background-color: green;color:green;">xxx</div>';
                        }else if (items[i-1].pt_priority == 2){
                            _background = '<div style="background-color: yellow;color:yellow;">xxx</div>';
                        }else if (items[i-1].pt_priority == 3){
                            _background = '<div style="background-color:pink;color:pink;">xxx</div>';
                        }else if (items[i-1].pt_priority == 4){
                            _background = '<div style="background-color:red;color:red;">xxx</div>';
                        }
                        jQuery('#callingQueueMoneyFullName'+i).html(items[i-1].full_name);
                        jQuery('#callingQueueMoneyDepartment'+i).html(items[i-1].department);
                    }else{
                            jQuery('#callingQueueMoneyFullName'+i).html("");
                            jQuery('#callingQueueMoneyDepartment'+i).html("");
                    }
                }
            }else{
                for (let i = 1; i <= limit; i++) {
                    jQuery('#callingQueueMoneyFullName'+i).html("");
                    jQuery('#callingQueueMoneyDepartment'+i).html("");
                }
            }
        }

        function _setCurrentQueueListDrug(items,limit) {
            if(items.length){
                for (let i = 1; i <= limit; i++) {
                    if(i<=items.length){
                        let _background;
                        if (items[i-1].pt_priority == 0){
                            _background = '<div style="background-color: white;color:white;min-width:50%;">xxx</div>';
                        }else if (items[i-1].pt_priority == 1){
                            _background = '<div style="background-color: green;color:green;">xxx</div>';
                        }else if (items[i-1].pt_priority == 2){
                            _background = '<div style="background-color: yellow;color:yellow;">xxx</div>';
                        }else if (items[i-1].pt_priority == 3){
                            _background = '<div style="background-color:pink;color:pink;">xxx</div>';
                        }else if (items[i-1].pt_priority == 4){
                            _background = '<div style="background-color:red;color:red;">xxx</div>';
                        }
                        jQuery('#callingQueueDrugFullName'+i).html(items[i-1].full_name);
                        jQuery('#callingQueueDrugDepartment'+i).html(items[i-1].department);
                    }else{
                            jQuery('#callingQueueDrugFullName'+i).html("");
                            jQuery('#callingQueueDrugDepartment'+i).html("");
                    }
                }
            }else{
                for (let i = 1; i <= limit; i++) {
                    jQuery('#callingQueueDrugFullName'+i).html("");
                    jQuery('#callingQueueDrugDepartment'+i).html("");
                }
            }
        }
    </script>
</html>
