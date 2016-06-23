
var firmware_version_reported = false;
var lasaurapp_version_reported = false;
var progress_not_yet_done_flag = false;
var hardware_status = {};

(function($){
  $.fn.uxmessage = function(kind, text, max_length) {
    if (max_length == null) {
      max_length = 100;
    }

    if (text.length > max_length) {
      text = text.slice(0,max_length) + '\n...'
    }

    text = text.replace(/\n/g,'<br>')
    
    if (kind == 'notice') {
      $('#log_content').prepend('<div class="log_item log_notice well" style="display:none">' + text + '</div>');
      $('#log_content').children('div').first().show('blind');
      if ($('#log_content').is(':hidden')) {
        $().toastmessage('showNoticeToast', text);
      }
    } else if (kind == 'success') {
      $('#log_content').prepend('<div class="log_item log_success well" style="display:none">' + text + '</div>');
      $('#log_content').children('div').first().show('blind');
      if ($('#log_content').is(':hidden')) {
        $().toastmessage('showSuccessToast', text);   
      }
    } else if (kind == 'warning') {
      $('#log_content').prepend('<div class="log_item log_warning well" style="display:none">' + text + '</div>');
      $('#log_content').children('div').first().show('blind');
      if ($('#log_content').is(':hidden')) {
        $().toastmessage('showWarningToast', text);   
      }
    } else if (kind == 'error') {
      $('#log_content').prepend('<div class="log_item log_error well" style="display:none">' + text + '</div>');
      $('#log_content').children('div').first().show('blind');
      if ($('#log_content').is(':hidden')) {
        $().toastmessage('showErrorToast', text);   
      }
    }

    while ($('#log_content').children('div').length > 200) {
      $('#log_content').children('div').last().remove();
    }

  };
})(jQuery); 


function send_gcode(gcode, success_msg, progress) {

  if (typeof gcode === "string" && gcode != '') {
    // $().uxmessage('notice', gcode, Infinity);
    $.ajax({
      type: "POST",
      url: "/gcode",
      data: {'job_data':gcode},
      // dataType: "json",
      success: function (data) {
        if (data == "__ok__") {
          $().uxmessage('success', success_msg);
          if (progress = true) {
            // show progress bar, register live updates
            if ($('#progressbar').children().first().width() == 0) {
              $('#progressbar').children().first().width('5%');
              $('#progressbar').show();
              progress_not_yet_done_flag = true;
              setTimeout(update_progress, 2000);
            }
          }
        } else {
          $().uxmessage('error', "バックエンドエラー: " + data);
        }
      },
      error: function (data) {
        $().uxmessage('error', "タイムアウト. SmartLaserサーバーがダウンしたかもしてません。");
      },
      complete: function (data) {
        // future use
      }
    });
  } else {
    $().uxmessage('error', "Gコードがありません");
  }
}


function update_progress() {
  $.get('/queue_pct_done', function(data) {
    if (data.length > 0) {
      var pct = parseInt(data);
      $('#progressbar').children().first().width(pct+'%');
      setTimeout(update_progress, 2000);         
    } else {
      if (progress_not_yet_done_flag) {
        $('#progressbar').children().first().width('100%');
        $().uxmessage('notice', "完了");
        progress_not_yet_done_flag = false;
        setTimeout(update_progress, 2000);
      } else {
        $('#progressbar').hide();
        $('#progressbar').children().first().width(0); 
      }
    }
  });
}


function open_bigcanvas(scale, deselectedColors) {
  var w = scale * app_settings.canvas_dimensions[0];
  var h = scale * app_settings.canvas_dimensions[1];
  $('#container').before('<a id="close_big_canvas" href="#"><canvas id="big_canvas" width="'+w+'px" height="'+h+'px" style="border:1px dashed #aaaaaa;"></canvas></a>');
  var mid = $('body').innerWidth()/2.0-30;
  $('#close_big_canvas').click(function(e){
    close_bigcanvas();
    return false;
  });
  $("html").on('keypress.closecanvas', function (e) {
    if ((e.which && e.which == 13) || (e.keyCode && e.keyCode == 13) ||
        (e.which && e.which == 27) || (e.keyCode && e.keyCode == 27)) {
      // on enter or escape
      close_bigcanvas();
      return false;
    } else {
      return true;
    }
  });
  // $('#big_canvas').focus();
  $('#container').hide();
  var bigcanvas = new Canvas('#big_canvas');
  // DataHandler.draw(bigcanvas, 4*app_settings.to_canvas_scale, getDeselectedColors());
  if (deselectedColors === undefined) {
    DataHandler.draw(bigcanvas, scale*app_settings.to_canvas_scale);
  } else {
    DataHandler.draw(bigcanvas, scale*app_settings.to_canvas_scale, deselectedColors);
  }
}


function close_bigcanvas() {
  $('#big_canvas').remove();
  $('#close_big_canvas').remove();
  $('html').off('keypress.closecanvas');
  delete bigcanvas;
  $('#container').show();
}


function generate_download(filename, filedata) {
  $.ajax({
    type: "POST",
    url: "/stash_download",
    data: {'filedata': filedata},
    success: function (data) {
      var element = document.createElement("a");
      element.download = filename;
      element.href = location.origin + "/download/" + data + "/" + filename;
      element.click();
    },
    error: function (data) {
      $().uxmessage('error', "タイムアウト. SmartLaserサーバーがダウンしたかもしてません。");
    },
    complete: function (data) {
      // future use
    }
  });
}

function evaluate_data(d) {
  if((d == 'true') || (d == 'True') || (d == '1'))  return true;
  if((d == 'false') || (d == 'False') || (d == '0'))  return false;
  return d;
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////



$(document).ready(function(){
  
  $().uxmessage('notice', "開始");
  
  $('#feedrate_field').val(app_settings.max_seek_speed);

  $('#tab_logs_button').click(function(){
    $('#log_content').show()
    $('#tab_logs div.alert').show()
  })


  //////// serial connect and pause button ////////
  var pause_btn_state = false;
  var assist_btn_state = true;
  var power_btn_state = 0; // 0:power-off/1:disconnect/2:power-on/3:processing
  var power_btn_in_hover = false;
  var limit_count = 0;
  function apply_status() {

    apply_power_btn_status();
    apply_air_btn_status();
    apply_pause_btn_status()
    apply_door_status();
    apply_ctrl_btn_active();
  };
  
  function apply_power_btn_status() {

    if(hardware_status.power) {
      if(hardware_status.serial_connected) {
        if(hardware_status.ready) {
          if(power_btn_in_hover) {
            $('#power_btn').html("電源Off");
          } else {
            $('#power_btn').html("電源On");
          } 
          $('#power_btn').removeClass('btn-warning');
          $('#power_btn').removeClass('btn-inverse');
          $('#power_btn').addClass('btn-success');
          $('#power_btn').removeClass('disabled');
          power_btn_state = 2;
        } else {
          $('#power_btn').html("動作中");
          $('#power_btn').removeClass('btn-success');
          $('#power_btn').removeClass('btn-inverse');
          $('#power_btn').addClass('btn-warning');
          $('#power_btn').addClass('disabled');
          power_btn_state = 3;
        }
      } else {
        if(power_btn_in_hover) {
          $('#power_btn').html("電源Off");
        } else {
          $('#power_btn').html("未接続");
        }
        $('#power_btn').removeClass('btn-warning');
        $('#power_btn').removeClass('btn-success');
        $('#power_btn').addClass('btn-inverse');
        $('#power_btn').removeClass('disabled');
        power_btn_state = 1;
        firmware_version_reported = false;
      }
    } else {
      $('#power_btn').removeClass('btn-success');
      $('#power_btn').removeClass('btn-warning');
      $('#power_btn').removeClass('btn-inverse');
      if(app_settings.disable_power_on == true) {
        $('#power_btn').addClass('disabled');
        $('#power_btn').html("電源Off");
      } else {
        if(power_btn_in_hover) {
          $('#power_btn').html("電源On");
        } else {
          $('#power_btn').html("電源Off");
        }
        $('#power_btn').removeClass('disabled');
      }
      power_btn_state = 0;
      firmware_version_reported = false;
    }
  };

  function apply_air_btn_status() {

    if (hardware_status.power && hardware_status.serial_connected) {
      if (hardware_status.assist_air) {
        $('#air_btn').removeClass('btn-warning');
        $('#air_btn').html('<i class="icon-flag"></i>');
        assist_btn_state = true;
      } else {
        $('#air_btn').removeClass('disabled');
        $('#air_btn').addClass('btn-warning');
        $('#air_btn').html('<i class="icon-fire"></i>');
        assist_btn_state = false;
      }
    } else {
      $('#air_btn').removeClass('btn-warning');
      $('#air_btn').addClass('disabled');
      $('#air_btn').html('<i class="icon-flag"></i>');
      assist_btn_state = true;
    }
  };

  function apply_pause_btn_status() {

    if (hardware_status.power && hardware_status.serial_connected) {
      if (hardware_status.paused) {
        $('#pause_btn').addClass('btn-info');
        $('#pause_btn').html('<i class="icon-play"></i>');
        pause_btn_state = true;
      } else {
        $('#pause_btn').removeClass('btn-info');
        $('#pause_btn').html('<i class="icon-pause"></i>');
        pause_btn_state = false;
      }
    } else {
      $('#pause_btn').removeClass('btn-info');
      $('#pause_btn').html('<i class="icon-pause"></i>');
      pause_btn_state = false;
    }
  };

  function apply_door_status() {

    if (hardware_status.power && hardware_status.serial_connected) {
      if (hardware_status.door_open) {
       $('#door_status_btn').removeClass('btn-success');
        $('#door_status_btn').addClass('btn-warning');
      } else {
       $('#door_status_btn').removeClass('btn-warning');
       $('#door_status_btn').addClass('btn-success');
      }
    } else {
      $('#door_status_btn').removeClass('btn-success');
      $('#door_status_btn').removeClass('btn-warning');
    }
  };
  
  function apply_ctrl_btn_active() {

    if (hardware_status.power && hardware_status.serial_connected && hardware_status.ready) {
      $('#go_to_origin').removeClass('disabled');
      $('#homing_cycle').removeClass('disabled');
      $('#job_submit').removeClass('disabled');
      $('#job_bbox_submit').removeClass('disabled');
      $('#location_set_btn').removeClass('disabled');
      $('#origin_set_btn').removeClass('disabled');
      $('#jog_up_btn').removeClass('disabled');
      $('#jog_left_btn').removeClass('disabled');
      $('#jog_right_btn').removeClass('disabled');
      $('#jog_down_btn').removeClass('disabled');
    } else {
      $('#go_to_origin').addClass('disabled');
      $('#homing_cycle').addClass('disabled');
      $('#job_submit').addClass('disabled');
      $('#job_bbox_submit').addClass('disabled');
      $('#location_set_btn').addClass('disabled');
      $('#origin_set_btn').addClass('disabled');
      $('#jog_up_btn').addClass('disabled');
      $('#jog_left_btn').addClass('disabled');
      $('#jog_right_btn').addClass('disabled');
      $('#jog_down_btn').addClass('disabled');
    }
    if (hardware_status.power && hardware_status.serial_connected) {
      $('#pause_btn').removeClass('disabled');
      $('#cancel_btn').removeClass('disabled');
      $('#air_btn').removeClass('disabled');
    } else {
      $('#pause_btn').addClass('disabled');
      $('#cancel_btn').addClass('disabled');
      $('#air_btn').addClass('disabled');
    }
  };
  
  function apply_location_field() {
  
    if (hardware_status.power && hardware_status.serial_connected) {
      if (hardware_status.x && hardware_status.y) {
        // only update if not manually entering at the same time
        if (!$('#x_location_field').is(":focus") &&
            !$('#y_location_field').is(":focus") &&
            !$('#location_set_btn').is(":focus") &&
            !$('#origin_set_btn').is(":focus"))
        {
          var x = parseFloat(hardware_status.x).toFixed(2) - app_settings.table_offset[0];
          $('#x_location_field').val(x.toFixed(2));
          $('#x_location_field').animate({
            opacity: 0.5
          }, 100, function() {
            $('#x_location_field').animate({
              opacity: 1.0
            }, 600, function() {});
          });
          var y = parseFloat(hardware_status.y).toFixed(2) - app_settings.table_offset[1];
          $('#y_location_field').val(y.toFixed(2));
          $('#y_location_field').animate({
            opacity: 0.5
          }, 100, function() {
            $('#y_location_field').animate({
              opacity: 1.0
            }, 600, function() {});
          });
        }
      }
    }
  };

  function error_and_version_check() {

    if (hardware_status.power && hardware_status.serial_connected) {
      if (hardware_status.limit_hit) {
        if (limit_count > 5) {
          $().uxmessage('error', "リミットになりました！!");
          $().uxmessage('notice', "ストップモードをリセットするために原点復帰を実行してください。");
          limit_count = 0;
        } else {
          limit_count++;
        }
      }
      if (hardware_status.buffer_overflow) {
        $().uxmessage('error', "Rxバッファーオーバーフロー!");
      }
      if (hardware_status.transmission_error) {
        $().uxmessage('error', "送信エラー!");
      }
      if (hardware_status.firmware_version && !firmware_version_reported) {
        $().uxmessage('notice', "ファームウェア v" + hardware_status.firmware_version);
        $('#firmware_version').html(hardware_status.firmware_version);
        firmware_version_reported = true;
      }
    }
    if (hardware_status.lasaurapp_version && !lasaurapp_version_reported) {
      $().uxmessage('notice', "SmartLaser v" + hardware_status.lasaurapp_version);
      $('#lasaurapp_version').html(hardware_status.lasaurapp_version);
      lasaurapp_version_reported = true;
    }
  };

  function apply_tabs() {
    if(hardware_status['admin']) {
      $('#tab_accounts_button').show();
    } else {
      $('#tab_accounts_button').hide();
    }
  }

  function poll_hardware_status() {
  
    $.getJSON('/status', function(data) {
      for(i in data) {
        hardware_status[i] = evaluate_data(data[i]);
      }
      apply_status();
      apply_tabs();
      apply_location_field();
      error_and_version_check();
      if(('accounts' in data) && ('statistics' in data)) {
        show_accounts(data);
      }
      setTimeout(function() {poll_hardware_status()}, 500);
    }).error(function() {
      setTimeout(function() {poll_hardware_status()}, 5000);
    });
  }
  poll_hardware_status();


  $('#power_btn').click(function(e){
    if((power_btn_state == 1) || (power_btn_state == 2)) {
      power_btn_state = 0;
      $.get('/power/' + power_btn_state, function(data) {
        apply_status();
      });
    } else if((power_btn_state == 0) && (app_settings.disable_power_on != true)) {
      power_btn_state = 2;
      $.get('/power/' + power_btn_state, function(data) {
        apply_status();
     });
    }
    e.preventDefault();
  });

  $('#power_btn').hover(
    function() {
      power_btn_in_hover = true;
      apply_status();
    },
    function () {
      power_btn_in_hover = false;
      apply_status();
    }
  );

  $('#pause_btn').click(function(e){

    if (hardware_status.power && hardware_status.serial_connected) {
      if (pause_btn_state == true) {  // unpause
        $.get('/pause/0', function(data) {
          pause_btn_state = evaluate_data(data);
          apply_status();
        });
      } else {  // pause
        $.get('/pause/1', function(data) {
          pause_btn_state = true;
          $().uxmessage('notice', "一時停止中");
          apply_status();
        });
      }
    }
    e.preventDefault();   
  }); 

  $('#air_btn').click(function(e) {

    if (hardware_status.power && hardware_status.serial_connected) {
      if (assist_btn_state == true) {  // assist off
        $.get('/assist_air/0', function(data) {
          assist_btn_state = false;
          apply_status();
        });
      } else {  // assit on
        $.get('/assist_air/1', function(data) {
          assist_btn_state = true;
          apply_status();
        });
      }
    }
  });
  
  $('#cancel_btn').click(function(e){

    if (hardware_status.power && hardware_status.serial_connected) {
      var gcode = '!\n'  // ! is enter stop state char
      send_gcode(gcode, "停止中 ...", false);
      var delayedresume = setTimeout(function() {
        var gcode = '~\nG90\nM81\nG0X0Y0F'+app_settings.max_seek_speed+'\n'  // ~ is resume char
        send_gcode(gcode, "リセット中 ...", false);
      }, 1000);
      pause_btn_state = false;
    }
    apply_status();
    e.preventDefault();
  });
  
  $('#homing_cycle').click(function(e){

    if (hardware_status.power && hardware_status.serial_connected) {
      var gcode = '!\n'  // ! is enter stop state char
      send_gcode(gcode, "リセット中 ...", false);
      var delayedresume = setTimeout(function() {
          var gcode = '~\nG90\nG30\n'  // ~ is resume char
          send_gcode(gcode, "原点復帰中 ...", false);
      }, 1000);
      pause_btn_state = false;
    }
    apply_status();
    e.preventDefault();
  });

  $('#go_to_origin').click(function(e){

    if (hardware_status.power && hardware_status.serial_connected) {
      if(e.shiftKey) {
        // also reset offset
        reset_offset();
      }
      var gcode;
      gcode = 'G90\nG0X0Y0F'+app_settings.max_seek_speed+'\n'
      // $().uxmessage('notice', gcode);  
      send_gcode(gcode, "原点へ移動中 ...", false);
    }
    e.preventDefault();   
  });  

  /// tab shortcut keys /////////////////////////
  $(document).on('keypress', null, 'p', function(e){
    $('#pause_btn').trigger('click');
    return false;
  });

  $(document).on('keypress', null, '0', function(e){
    $('#go_to_origin').trigger('click');
    return false;
  });

  var cancel_modal_active = false;
  $(document).on('keyup', null, 'esc', function(e){
    if (cancel_modal_active === true) {
      $('#cancel_modal').modal('hide');
      cancel_modal_active = false;
    } else if(hardware_status.power && hardware_status.serial_connected && !hardware_status.ready){
      $('#cancel_modal').modal('show');
      $('#really_cancel_btn').focus();
      cancel_modal_active = true;
    }
    return false;
  });

  $('#really_cancel_btn').click(function(e){
    $('#cancel_btn').trigger('click');
    $('#cancel_modal').modal('hide');
    cancel_modal_active = false;
  });


  /// tab shortcut keys /////////////////////////

  $(document).on('keypress', null, 'j', function(e){
    $('#tab_jobs_button').trigger('click');
    return false;
  });

  $(document).on('keypress', null, 'i', function(e){
    $('#tab_import_button').trigger('click');
    return false;
  });

  $(document).on('keypress', null, 'm', function(e){
    $('#tab_mover_button').trigger('click');
    return false;
  });

  $(document).on('keypress', null, 'l', function(e){
    $('#tab_logs_button').trigger('click');
    return false;
  });
  
});  // ready
