


///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

var accountUser = null;
var accountsTable = {};
function show_accounts(data) {
  $('#accounts_list').html('');
  accountsTable = {};
  if(!data || !data['accounts']) return; 
  for (var i in data.accounts) {
    var account = data.accounts[i];
    var user = account['user'];
    var statistics = data.statistics[user];
    var lastAccess = new Date(statistics['lastAccess'] * 1000);
    var lastAccessStr = '-';
    if(statistics['lastAccess']) 
      lastAccessStr = lastAccess.toLocaleString().replace(/:[0-9][0-9] .*$/, '');

    accountsTable[user] = { comment: account['comment'], admin: account['admin'] };
    var html = '<li><a href="#" id="accoutnts_list">';
    html += '<div><span class="accounts1">' + user + '</span>';
    html += '<span class="accounts2">' + accountsTable[user]['comment'] + '</span></div>';
    html += '<div><span class="accounts3">' + '使用時間: ' + Math.round(statistics['useTime']/60).toFixed() + '分　';
    html += 'レーザー実使用時間: ' + Math.round(statistics['laserTime']/60).toFixed() + '分　';
    html += '切断長: ' + Math.round(statistics['length']/1000).toFixed() + 'm　';
    html += '最終アクセス: ' + lastAccessStr;
    html += '</div></span></a></li>';
    $('#accounts_list').prepend(html);
    
    $('#accoutnts_list').click(function() {
      accountUser = $(this).find("span.accounts1").text();
      $('#account_modal_alert').text('');
      $('#account_modal_name').val(accountUser);
      $('#account_modal_name').attr('readonly', true);
      $('#account_modal_comment').val(accountsTable[accountUser]['comment']);
      $('#account_modal_comment').focus();
      $('#account_modal_admin').prop('checked', evaluate_data(accountsTable[accountUser]['admin']));
      $('#account_modify').show();
      $('#account_add').hide();
      $('#account_modal').modal('show');
      return true;
    });
  }
}

function sendmail(user, file) {

  subject = 'SmartLaserCO2 Certificate';
  body  = 'SmartLaserCO2のlogin用の証明書を作成しました。\n\n';
  body += '--------------------------------------------------------\n';
  body += location.origin.replace(/https:/, 'http:') + "/download/" + file + "/" + user + '.zip\n';
  body += '--------------------------------------------------------\n\n';
  body += 'zipを展開してsmartlaser_privateca.crtをinstall後、\n';
  body += user + '.p12ファイルをinstallして下さい。\n';
  body += 'パスワードはご自分のメールアドレスの＠より左側の部分です。\n';
  body += '必要に応じて証明書の信頼度の設定をして下さい。\n';
  body += '設定後、一度ブラウザーを終了して下さい。\n';
  body = body.replace(/\n\r?/g, '%0D%0A');

  var cc = 'cc=';
  for(account in accountsTable) {
    if(evaluate_data(accountsTable[account].admin)) {
      cc += account + ' ; ';
    }
  }
  if(cc == 'cc=') {
    cc = '';
  } else {
    cc = cc.replace(/; *$/, '&');
  }
/*
  var cc = '';
  for(account in accountsTable) {
    if(evaluate_data(accountsTable[account].admin)) {
      cc += 'cc=' + account + '&';
    }
  }
*/
  location.href = 'mailto:' + user + '?' + cc + 'subject=' + subject + '&body=' + body;
}

$(document).ready(function(){

  $.getJSON('/accounts/get', show_accounts);

  $('#account_modify').click(function() {
    $('#account_modal_alert').text('');
    var user = $('#account_modal_name').val();
    var comment = $('#account_modal_comment').val().trim();
    var admin = $('#account_modal_admin').prop('checked');
    if(comment == '') return;
    if((hardware_status['user'] != user) || admin) {
      $.ajax({
        type: "POST",
        url: "/accounts/set",
        data: {'user': user,
               'comment': comment,
               'admin': admin},
        success: function(data) {
          show_accounts(JSON.parse(data));
        },
        complete: function(data) {
          $('#account_modal').modal('hide');
        }
      });
    } else {
      $('#account_modal_alert').text('自分の管理者権限は外せません');
    }
  });

  $('#account_add').click(function() {
    $('#account_modal_alert').text('');
    var user = $('#account_modal_name').val().trim().toLowerCase();
    if(user.search(/.@./) < 0) return;
    var comment = $('#account_modal_comment').val().trim();
    if(comment == '') return;
    var admin = $('#account_modal_admin').prop('checked');
    $.ajax({
      type: "POST",
      url: "/accounts/set",
      data: {'user': user,
             'comment': comment,
             'admin': admin},
      success: function(data) {
        show_accounts(JSON.parse(data));
      },
      complete: function(data) {
        $.get('/accounts/certs/' + user, function(file) {
          sendmail(user, file);
          $('#account_modal').modal('hide');
        });
       }
    });
  });

  $('#account_cert').click(function() {
    var user = $('#account_modal_name').val();
    $.get('/accounts/certs/' + user, function(file) {
      sendmail(user, file);
      $('#account_modal').modal('hide');
    });
  });
  
  $('#account_remove').click(function() {
    $('#account_modal_alert').text('');
    var user = $('#account_modal_name').val();
    if(!evaluate_data(accountsTable[user]['admin'])) {
      $.getJSON('/accounts/remove/' + user, function(data) {
        show_accounts(data);
        $('#account_modal').modal('hide');
      });
    } else {
      $('#account_modal_alert').text('管理者の削除はできません');
    }
  });

  $('#account_modal_add').click(function() {
    $('#account_modal_alert').text('');
    $('#account_modal_name').focus();
    $('#account_modal_name').val('');
    $('#account_modal_name').attr('readonly', false);
    $('#account_modal_comment').val('所属等');
    $('#account_modal_admin').prop('checked', false);
    $('#account_add').show();
    $('#account_cert').hide();
    $('#account_modify').hide();
    $('#account_modal').modal('show');
  });

  $('#tab_accounts_button').click(function() {
      $.getJSON('/accounts/get', show_accounts);
  });
  
  return true;

});  // ready
