
var gcode_coordinate_offset = undefined;

function reset_offset() {
  $("#offset_area").hide();
  $('#offset_area').css({'opacity':0.0, left:0, top:0});
  gcode_coordinate_offset = undefined;
  $("#cutting_area").css('border', '1px dashed #ff0000');
  $("#offset_area").css('border', '1px dashed #aaaaaa');
  var gcode = 'G54\n';
  gcode += 'G90\nG0X0Y0F'+app_settings.max_seek_speed+'\n'
  send_gcode(gcode, "原点を初期化", false);
  $('#coordinates_info').text('');
}



///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////



$(document).ready(function(){

  $('#cutting_area').height(app_settings.canvas_dimensions[1]);
  $('#x_location_field').val('');
  $('#y_location_field').val('');

  var isDragging = false;
  
  function assemble_and_send_gcode(x, y, do_not_scale) {
    // x or y can be NaN or null
    // this allows for moving only along x or y
    var x_phy;
    var y_phy;
    if (do_not_scale == null || do_not_scale === false) {
      x_phy = x*app_settings.to_physical_scale;
      y_phy = y*app_settings.to_physical_scale;
    } else {
      x_phy = x;
      y_phy = y;
    }
    /// contrain
    if (!(isNaN(x_phy)) && x_phy != null) {  // allow for NaN, null
      if (x_phy < 0) {
        x_phy = 0;
        $().uxmessage('warning', "x軸は領域内からはみ出しています。");
      } else if (x_phy > app_settings.work_area_dimensions[0]) {
        x_phy = app_settings.work_area_dimensions[0];
        $().uxmessage('warning', "x軸は領域内からはみ出しています。");
      }
    }
    if (!(isNaN(y_phy)) && y_phy != null) {
      if (y_phy < 0) {
        y_phy = 0;
        $().uxmessage('warning', "y軸は領域内からはみ出しています。");
      } else if (y_phy > app_settings.work_area_dimensions[1]) {
        y_phy = app_settings.work_area_dimensions[1];
        $().uxmessage('warning', "y軸は領域内からはみ出しています。");
      }
    }
    var g0_or_g1 = 'G0';
    var air_assist_on = '';
    var air_assist_off = '';
    if($('#feed_btn').hasClass("active")){
      g0_or_g1 = 'G1';
      air_assist_on = 'M80\n';
      air_assist_off = 'M81\n';
    }
    var feedrate = DataHandler.mapConstrainFeedrate($("#feedrate_field" ).val());
    var intensity =  DataHandler.mapConstrainIntesity($( "#intensity_field" ).val());
    var gcode = 'G90\n'+air_assist_on+'S'+ intensity + '\n' + g0_or_g1;
    if (!(isNaN(x_phy)) && x_phy != null) {
      gcode += 'X' + x_phy.toFixed(app_settings.num_digits);
    }
    if (!(isNaN(y_phy)) && y_phy != null) {
      gcode += 'Y' + y_phy.toFixed(app_settings.num_digits)
    }
    gcode += 'F' + feedrate + '\nS0\n'+air_assist_off; 
    // $().uxmessage('notice', gcode);
    send_gcode(gcode, "移動命令送信", false);    
  }
  
  function assemble_info_text(x,y) {
    var x_phy = x*app_settings.to_physical_scale;
    var y_phy = y*app_settings.to_physical_scale;
    var coords_text;
    var move_or_cut = '移動';
    if($('#feed_btn').hasClass("active")){
      move_or_cut = '切断移動';
    }
    var feedrate = DataHandler.mapConstrainFeedrate($( "#feedrate_field" ).val());
    var intensity =  DataHandler.mapConstrainIntesity($( "#intensity_field" ).val());
    var coords_text;
    if (move_or_cut == '切断移動') {
      coords_text = '(' + 
                    x_phy.toFixed(0) + ', '+ 
                    y_phy.toFixed(0) + ')へ' + move_or_cut + '、 速度:' +
                    feedrate + 'mm/min、 レーザー強度:' + Math.round(intensity/2.55) + '%';
    } else {
      coords_text = ' (' + x_phy.toFixed(0) + ', '+ 
                    y_phy.toFixed(0) + ')へ' + move_or_cut + '、 速度:' + feedrate + 'mm/min'
    }
    return coords_text;
  }

  function assemble_and_set_offset(x, y) {
    if (x == 0 && y == 0) {
      reset_offset()
    } else {
      $("#offset_area").show();
      $("#offset_area").animate({
        opacity: 1.0,
        left: x,
        top: y,
        width: app_settings.work_area_dimensions[0]/app_settings.to_physical_scale-x,
        height: app_settings.work_area_dimensions[1]/app_settings.to_physical_scale-y
      }, 200 );
      gcode_coordinate_offset = [x,y];
      var x_phy = x*app_settings.to_physical_scale + app_settings.table_offset[0];
      var y_phy = y*app_settings.to_physical_scale + app_settings.table_offset[1];
      var gcode = 'G10 L2 P1 X'+ x_phy.toFixed(app_settings.num_digits) + 
                  ' Y' + y_phy.toFixed(app_settings.num_digits) + '\nG55\n';
      gcode += 'G90\nG0X0Y0F'+app_settings.max_seek_speed+'\n'
      send_gcode(gcode, "原点を移動", false);
      $(this).css('border', '1px dashed #aaaaaa');
      $("#offset_area").css('border', '1px dashed #ff0000');
    }
  }
  


  
  $("#cutting_area").mousedown(function() {
    isDragging = true;
  }).mouseup(function() {
    isDragging = false;
  });
  

  $("#cutting_area").click(function(e) {
    if (hardware_status.power && hardware_status.serial_connected && hardware_status.ready) {
      var offset = $(this).offset();
      var x = (e.pageX - offset.left);
      var y = (e.pageY - offset.top);

      if(e.shiftKey) {
        assemble_and_set_offset(x,y);
      } else if (!gcode_coordinate_offset) {  
        assemble_and_send_gcode(x,y);
      } else {
        var pos = $("#offset_area").position()
        if ((x < pos.left) || (y < pos.top)) {       
          //// reset offset
          reset_offset();
        }
      }
    }
    return false;
  });


  $("#cutting_area").hover(
    function () {
      if (!gcode_coordinate_offset) {
        $(this).css('border', '1px dashed #ff0000');
      }
      $(this).css('cursor', 'crosshair');
    },
    function () {
      $(this).css('border', '1px dashed #aaaaaa');
      $(this).css('cursor', 'pointer'); 
      $('#coordinates_info').text('');    
    }
  );
  
  $("#cutting_area").mousemove(function (e) {
    var offset = $(this).offset();
    var x = (e.pageX - offset.left);
    var y = (e.pageY - offset.top);
    if(e.shiftKey) {
      var x_phy = x*app_settings.to_physical_scale;
      var y_phy = y*app_settings.to_physical_scale;
      coords_text = '原点を移動(' + x_phy.toFixed(0) + ', '+ y_phy.toFixed(0) + ')';
    } else {
      if (!gcode_coordinate_offset) {
        coords_text = assemble_info_text(x,y);
        if (e.altKey &&isDragging) {
            assemble_and_send_gcode(x,y);
        }
      } else {
        var pos = $("#offset_area").position()
        if ((x < pos.left) || (y < pos.top)) {           
          coords_text = '原点をリセット';
        } else {
          coords_text = '';
        }
      }
    }
    $('#coordinates_info').text(coords_text);
  });
  
  $("#offset_area").click(function(e) { 
    if (hardware_status.power && hardware_status.serial_connected && hardware_status.ready) {
      if(!e.shiftKey) {
        var offset = $(this).offset();
        var x = (e.pageX - offset.left);
        var y = (e.pageY - offset.top);     
        assemble_and_send_gcode(x,y);
        return false
      }
    }
  });

  $("#offset_area").hover(
    function () {
    },
    function () {
      $('#offset_info').text('');   
    }
  );
  
  $("#offset_area").mousemove(function (e) {
    if(!e.shiftKey) {
      var offset = $(this).offset();
      var x = (e.pageX - offset.left);
      var y = (e.pageY - offset.top);
      $('#offset_info').text(assemble_info_text(x,y));
    } else {
      $('#offset_info').text('');
    }
  });
  
  
  /// motion parameters /////////////////////////

  $("#intensity_field" ).val('0');
  $("#feedrate_field" ).val(app_settings.max_seek_speed);
  
  $("#seek_btn").click(function(e) {
    $("#intensity_field" ).hide();
    $("#intensity_field_disabled" ).show();
    $('#loc_move_cut_word').html('Move');
  });  
  $("#feed_btn").click(function(e) {
    $("#intensity_field_disabled" ).hide();
    $("#intensity_field" ).show();
    $('#loc_move_cut_word').html('Cut');
  });   
  
  $("#feedrate_btn_slow").click(function(e) {
    $("#feedrate_field" ).val("600");
  });  
  $("#feedrate_btn_medium").click(function(e) {
    $("#feedrate_field" ).val("2000");
  });  
  $("#feedrate_btn_fast").click(function(e) {
    $("#feedrate_field" ).val(app_settings.max_seek_speed);
  });  
  $("#feedrate_field").focus(function(e) {
    $("#feedrate_btn_slow").removeClass('active');
    $("#feedrate_btn_medium").removeClass('active');
    $("#feedrate_btn_fast").removeClass('active');
  });
  
  if ($("#feedrate_field" ).val() != app_settings.max_seek_speed) {
    $("#feedrate_btn_slow").removeClass('active');
    $("#feedrate_btn_medium").removeClass('active');
    $("#feedrate_btn_fast").removeClass('active');    
  }

  /// jog buttons ///////////////////////////////

  function move_cursor(x, y, str) {
    if ($('#tab_mover').is(":visible") && hardware_status.power && hardware_status.serial_connected && hardware_status.ready) {
      var gcode = 'G91\nG0X' + x.toFixed(0) + 'Y' + y.toFixed(0) + 'F' + app_settings.max_seek_speed+'\nG90\n';
      send_gcode(gcode, str, false);
    }
  };

  $("#jog_up_btn").click(function(e) {
    if(e.shiftKey) {
      move_cursor(0, -50, "上に移動 ...");
    } else if(e.altKey) {
      move_cursor(0, -2, "上に移動 ...");
    } else {
      move_cursor(0, -10, "上に移動 ...");
    }
  });
  $("#jog_left_btn").click(function(e) {
    if(e.shiftKey) {
      move_cursor(-50, 0, "左に移動 ...");
    } else if(e.altKey) {
      move_cursor(-2, 0, "左に移動 ...");
    } else {
      move_cursor(-10, 0, "左に移動 ...");
    }
  });
  $("#jog_right_btn").click(function(e) {
    if(e.shiftKey) {
      move_cursor(50, 0, "右に移動 ...");
    } else if(e.altKey) {
      move_cursor(2, 0, "右に移動 ...");
    } else {
      move_cursor(10, 0, "右に移動 ...");
    }
  });
  $("#jog_down_btn").click(function(e) {
    if(e.shiftKey) {
      move_cursor(0, 50, "下に移動 ...");
    } else if(e.altKey) {
      move_cursor(0, 2, "下に移動 ...");
    } else {
      move_cursor(0, 10, "下に移動 ...");
    }
  });


  /// jog keys //////////////////////////////////

  $(document).on('keydown', null, 'right', function(e){
    move_cursor(10, 0, "右に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'alt+right', function(e){
    move_cursor(2, 0, "右に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'shift+right', function(e){
    move_cursor(50, 0, "右に移動 ...");
    return false;
  });

  $(document).on('keydown', null, 'left', function(e){
    move_cursor(-10, 0, "左に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'alt+left', function(e){
    move_cursor(-2, 0, "左に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'shift+left', function(e){
    move_cursor(-50, 0, "左に移動 ...");
    return false;
  });

  $(document).on('keydown', null, 'up', function(e){
    move_cursor(0, -10, "上に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'alt+up', function(e){
    move_cursor(0, -2, "上に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'shift+up', function(e){
    move_cursor(0, -50, "上に移動 ...");
    return false;
  });

  $(document).on('keydown', null, 'down', function(e){
    move_cursor(0, 10, "下に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'alt+down', function(e){
    move_cursor(0, 2, "下に移動 ...");
    return false;
  });
  $(document).on('keydown', null, 'shift+down', function(e){
    move_cursor(0, 50, "下に移動 ...");
    return false;
  });


  /// numeral location buttons //////////////////
  $("#location_set_btn").click(function(e) {
    if (hardware_status.ready) {
      var x = parseFloat($('#x_location_field').val());
      var y = parseFloat($('#y_location_field').val());
      // NaN from parsing '' is ok
      assemble_and_send_gcode(x, y, true);
    }
  }); 

  $("#origin_set_btn").click(function(e) {
    if (hardware_status.ready) {
      var x_str = $('#x_location_field').val();
      if (x_str == '') {
        x_str = '0';
      }
      var x = parseFloat(x_str)*app_settings.to_canvas_scale;
      var y_str = $('#y_location_field').val();
      if (y_str == '') {
        y_str = '0';
      }
      var y = parseFloat(y_str)*app_settings.to_canvas_scale;
      assemble_and_set_offset(x, y);
    }
  });  

});  // ready
