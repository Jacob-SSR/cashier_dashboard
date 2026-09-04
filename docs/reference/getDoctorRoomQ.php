<?php
    include("../includes/config.php");
    $depcode = $_POST['depcode'];
    $limit = $_POST['limit'];

    $query = "SELECT o.oqueue,o.hn,CONCAT(pt.pname,pt.fname,' ','XXX') AS full_name,CONCAT('คุณ',pt.fname,' ',pt.lname) AS full_namecall,IFNULL(o.pt_priority,0) as 	pt_priority,
    sq.sd_queue_calling_status,department
    FROM sd_queue_calling sq
    INNER JOIN ovst o ON sq.sd_queue_calling_vn = o.vn
    INNER JOIN patient pt on o.hn = pt.hn
    INNER JOIN kskdepartment d on d.depcode = sq.sd_queue_calling_curdep
    WHERE /*o.ovstost = '00' AND*/ sq.sd_queue_calling_curdep IN(".$depcode.") 
    ORDER BY sq.sd_queue_calling_datetime DESC
    LIMIT ".$limit;
    $data = array();
    $result = mysql_query($query,$connection);
    $txt = "";
    while($row =mysql_fetch_assoc($result))
    {
        if ($row["sd_queue_calling_status"] == "Y"){
            $txt .= " ขอเชิญ ".$row["full_namecall"]." ที่ ".$row["department"]." ค่ะ ";
            $q1 = "UPDATE sd_queue_calling SET sd_queue_calling_status='N' WHERE sd_queue_calling_hn='".$row['hn']."' and sd_queue_calling_queue='".$row['oqueue']."'";
            mysql_query($q1,$connection);
        }
        $data[] = $row;
    }
    if($txt != ""){
        $txt=htmlspecialchars($txt);
        $txt=rawurlencode($txt);
        $html=file_get_contents('http://translate.google.com/translate_tts?ie=UTF-8&client=gtx&q='.$txt.'&tl=th-TH');
        $player="<audio id='audio' hidden autoplay controls='controls'><source src='data:audio/mpeg;base64,".base64_encode($html)."'></audio>";
        $curentData = new ArrayObject(['queues' => $data, 'audio' => $player]);
    }else {
        $curentData = new ArrayObject(['queues' => $data, 'audio' => '']);
    }
    
    
    echo json_encode($curentData);
?>