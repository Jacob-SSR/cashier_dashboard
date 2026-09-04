<?php
 include("../includes/config.php");
 $depcode = $_POST['depcode'];
 $limit = $_POST['limit'];
 
 $query = "	SELECT o.main_dep_queue,CONCAT(pt.pname,pt.fname,' ','XXX') AS full_name,IFNULL(o.pt_priority,0) as pt_priority,sc.*
 FROM ovst o 
 LEFT JOIN ovstost ov ON o.ovstost = ov.ovstost LEFT JOIN patient pt ON o.hn = pt.hn
 LEFT JOIN sd_queue_calling sc ON o.vn = sc.sd_queue_calling_vn AND o.oqueue = sc.sd_queue_calling_queue AND sc.sd_queue_calling_curdep IN(".$depcode.") 
 LEFT JOIN pt_priority po ON o.pt_priority = po.priority_code
 WHERE o.vstdate = CURDATE() AND (o.cur_dep_time >= time(sc.sd_queue_calling_datetime) OR sc.sd_queue_calling_datetime IS NULL ) 
 AND o.cur_dep IN(".$depcode.") ORDER BY o.cur_dep_time asc
 limit ".$limit;
 $data = array();
 $result = mysql_query($query,$connection);
 while($row =mysql_fetch_assoc($result))
 {
     $data[] = $row;
 }

 echo json_encode($data);

?>