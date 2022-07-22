humhub.module('mail.reply', function(module, require, $) {
    var selector = {
        messagesRoot: '#mail-conversation-root',
        replyButton: '.rocketmailreply-btn',
        convEntry: '.mail-conversation-entry',
        convEntryContent: '.mail-conversation-entry .content .message-frame .dropdown .dropdown-menu',
        convEntriesList: '.conversation-entry-list',
        mailAddonRoot: '.rocketcore-mail-addon-container',
        mailAddonRootEntry: '.rocketcore-mail-addon-entry',
        replyBtn: '.rocketmailreply-btn',
        editor: '.ProsemirrorEditor',
        messageDom: '[data-ui-richtext]',
        avatar: '.avatar img',
        reply: '.reply-container',
        replyAuthor: '.reply-author',
        replyText: '.reply-text',
        replyId: '#replyform-replyid',
        replyDetachButton: '#reply-detach',
    };

    var REPLY_MAX_LENGTH = 40;
    const EVENT_REPLY_CHANGED = 'mail:reply:changed';

    var Widget = require('ui.widget').Widget;
    var RichText = require('ui.richtext');
    var url = require('util').url;
    var MailReplyButton = Widget.extend();

    MailReplyButton.prototype.init = function() {
        this.api = PMApi;
        this.editor = this._getEditor();
    };

    MailReplyButton.prototype.handle = function() {
        const messageReply = Widget.instance(selector.reply);
        const messageId = this.getMessageId();
        messageReply.attachReply(messageId);
        this.focusEditor();
    };

    MailReplyButton.prototype.focusEditor = function() {
        var selection = this.api.state.Selection.atEnd(this.editor.view.state.doc);
        var $tr = this.editor.view.state.tr.setSelection(selection);
        this.editor.view.focus();
        this.editor.view.dispatch($tr.scrollIntoView());
    };

    MailReplyButton.prototype._getEditor = function() {
        return Widget.instance($(selector.messagesRoot).find(selector.editor)).editor;
    };

    MailReplyButton.prototype.getMessageId = function () {
        return this.$.closest(selector.convEntry).data('entry-id');
    };

    var MailReply = Widget.extend();
    MailReply.prototype.init = function () {
        this.api = PMApi;
        this.editor = Widget.instance($(selector.editor)).editor;
        this.domParser = this.api.model.DOMParser.fromSchema(this.editor.view.state.schema);
        this.initDetachButton();
    };

    MailReply.prototype.attachReply = function (messageId) {
        const $messageContainer = this.getMessageContainer(messageId);
        if (!$messageContainer.length) {
            module.log.error('Message container not found', messageId);
            return;
        }

        const messageInfo = this.getMessageInfo($messageContainer);
        this.setReplyAuthor(messageInfo.author);
        this.setReplyText(messageInfo.text);
        this.setReplyId(messageInfo.id);
        this.showReply();
        $(document).trigger(EVENT_REPLY_CHANGED, [messageInfo.id, messageInfo.author, messageInfo.text]);
    };

    MailReply.prototype.detachReply = function () {
        const replyId = this.getReplyId();
        this.setReplyAuthor('');
        this.setReplyText('');
        this.setReplyId('');
        this.hideReply();
        $(document).trigger(EVENT_REPLY_CHANGED, [replyId, '', '']);
    }

    MailReply.prototype.getMessageId = function ($messageContainer) {
        return $messageContainer.data('entry-id');
    };

    MailReply.prototype.getMessageAuthor = function ($messageContainer) {
        return $messageContainer.find(selector.avatar).data('original-title');
    };

    MailReply.prototype.getMessageInfo = function ($messageContainer) {
        const id = this.getMessageId($messageContainer);
        const author = this.getMessageAuthor($messageContainer);
        const text = this.getMessageTextCut($messageContainer);

        return {id, author, text};
    };

    MailReply.prototype._getDomNode = function($messageContainer) {
        return $messageContainer.find(selector.messageDom)[0];
    };

    MailReply.prototype.getNodesContent = function($messageContainer) {
        return this.domParser.parse(this._getDomNode($messageContainer));
    };

    MailReply.prototype.stripBlockquoteFromBeginning = function(node) {
        if (node.content.size && node.content.content[0].type.name === 'blockquote') {
            return node.cut(node.content.content[0].nodeSize);
        }
        return node;
    };

    MailReply.prototype.getMessageText = function ($messageContainer) {
        const node = this.stripBlockquoteFromBeginning(this.getNodesContent($messageContainer));
        let result = '';
        for (let i = 0; i < node.content.childCount; i++) {
            if (node.content.content[i].isTextblock) {
                const textContent = node.content.content[i].textContent;
                if (!textContent.length) {
                    continue;
                }
                result += result !== '' ? ' ' : '';
                result += node.content.content[i].textContent;
            }
        }

        return result;
    };

    MailReply.prototype.getMessageTextCut = function ($messageContainer) {
        const text = this.getMessageText($messageContainer);
        if (text.length <= REPLY_MAX_LENGTH) {
            return text;
        }

        return text.slice(0, REPLY_MAX_LENGTH) + '...';
    };

    MailReply.prototype.getMessageContainer = function (messageId) {
        return $(`${selector.convEntry}[data-entry-id="${messageId}"]`);
    };

    MailReply.prototype.getReplyAuthor = function () {
        return $(selector.replyAuthor).text();
    };

    MailReply.prototype.getReplyText = function () {
        return $(selector.replyText).text();
    };

    MailReply.prototype.getReplyId = function () {
        return $(selector.replyId).val();
    };

    MailReply.prototype.setReplyAuthor = function (author) {
        $(selector.replyAuthor).text(author);
    };

    MailReply.prototype.setReplyText = function (text) {
        $(selector.replyText).text(text);
    };

    MailReply.prototype.setReplyId = function (id) {
        $(selector.replyId).val(id);
    };

    MailReply.prototype.showReply = function () {
        $(selector.reply).css('display', 'flex');
    };

    MailReply.prototype.hideReply = function () {
        $(selector.reply).css('display', 'none');
    };

    MailReply.prototype.initDetachButton = function () {
        $(selector.replyDetachButton).click((e) => {
            e.preventDefault();
            this.detachReply();
            this.focusEditor();
        });
    };

    MailReply.prototype.focusEditor = function () {
        const editor = Widget.instance($(selector.editor));
        editor.focus();
    };

    var PMApi;
    var mutationObserver;
    var initialized = false;
    var $messagesRoot;
    var init = function() {
        module.log.debug("Trying to initialize");
        if (!isValidPage()) {
            if (initialized) {
                module.log.debug("Module was initialized before, but the current page is not managed");
                return cleanUp();
            }
            module.log.debug("Can't initialize - the current page is not managed");
            return false;
        }
        if (initialized) {
            module.log.debug("Already initialized");
            return true;
        }
        PMApi = RichText.prosemirror.api;
        $messagesRoot = $(selector.messagesRoot);
        if (!mutationObserver) {
            mutationObserver = new MutationObserver(initReplyButton)
        }

        mutationObserver.observe($messagesRoot[0], { childList: true, subtree: true });
        $(document).on('click', selector.replyButton, handleReplyBtnClicks);
        initialized = true;
        module.log.debug("Module initialized");
    };

    var cleanUp = function () {
        mutationObserver.disconnect();
        initialized = false;
        $(document).off('click', selector.replyButton, handleReplyBtnClicks);
        module.log.debug("Module disconnected");
    };

    var isValidPage = function() {
        var requestParam = url.getUrlParameter('r');
        return (requestParam && decodeURIComponent(requestParam).indexOf('mail/mail') > -1) ||
            location.pathname.indexOf('mail/mail') > -1;
    };

    var initReplyButton = function(mutations = []) {
        if (mutations.length <= 2) return false;
        ($messagesRoot || $(selector.messagesRoot)).find(selector.convEntryContent).each(function(idx, el) {
            var $el = $(el);
            const isBlocked = !!$el.closest('.mail-conversation-entry').find('.profile-disable').length;
            if (isBlocked) {
                return false;
            }
            if ($el.find(selector.mailAddonRoot).length) return true;
            var mailAddonRootEl = createMailAddonRoot();
            var replyButtonEl = createReplyBtn();
            mailAddonRootEl.appendChild(replyButtonEl);
            $el.append(mailAddonRootEl);
        });
    };

    var handleReplyBtnClicks = function(ev) {
        ev.preventDefault();
        var widget = Widget.instance(this);
        widget.handle();
    };

    var createReplyBtn = function() {
        var holder = document.createElement('div');
        var button = document.createElement('button');
        var label = document.createElement('span');
        var labelText =  getReplyLabel();
        label.innerText = labelText;
        holder.classList.add(selector.mailAddonRootEntry.replace('.', ''));
        button.classList.add(selector.replyButton.replace('.', ''));
        button.dataset.uiWidget = 'mail.reply.MailReplyButton';
        button.title = labelText;
        button.appendChild(label);
        holder.appendChild(button);
        return holder;
    };

    var createMailAddonRoot = function() {
        var rootEl = document.createElement('div');
        rootEl.classList.add(selector.mailAddonRoot.replace('.', ''));
        return rootEl;
    };

    var getReplyLabel = function() {
        return module.text('reply') || 'Reply';
    };

    const scrollToOriginalMessage = function (data) {
        const messageId = data.params.messageId;
        const conversationViewWidget = Widget.instance(selector.messagesRoot);
        conversationViewWidget.scrollLock = true;
        conversationViewWidget.scrollToMessage(messageId).then(() => {
            conversationViewWidget.scrollLock = false;
            conversationViewWidget.highlightMessage(messageId);
        });
    };

    module.export({
        initOnPjaxLoad: true,
        init: init,
        initReplyButton: initReplyButton,
        scrollToOriginalMessage: scrollToOriginalMessage,
        MailReply: MailReply,
        MailReplyButton: MailReplyButton
    });
});
