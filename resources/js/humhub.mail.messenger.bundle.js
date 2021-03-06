humhub.module('mail.ConversationView', function (module, require, $) {

    var Widget = require('ui.widget').Widget;
    var loader = require('ui.loader');
    var client = require('client');
    var additions = require('ui.additions');
    var object = require('util.object');
    var mail = require('mail.notification');
    var view = require('ui.view');
    var mailMobile = require('mail.mobile');

    var ConversationView = Widget.extend();

    ConversationView.prototype.init = function () {
        additions.observe(this.$);

        var that = this;
        window.onresize = function (evt) {
            that.updateSize(true);
        };

        if (!view.isSmall() && !view.isMedium()) {
            this.reload();
        }

        this.$.on('mouseenter', '.mail-conversation-entry', function () {
            $(this).find('.conversation-menu').show();
        }).on('mouseleave', '.mail-conversation-entry', function () {
            $(this).find('.conversation-menu').hide();
        });

        this.detectOpenedDialog();
    };

    ConversationView.prototype.loader = function (load) {
        if (load !== false) {
            loader.set(this.$);
        } else {
            loader.reset(this.$);
        }
    };

    ConversationView.prototype.markSeen = function (id) {
        client.post(this.options.markSeenUrl, {data: {id: id}}).then(function (response) {
            if (object.isDefined(response.messageCount)) {
                mail.setMailMessageCount(response.messageCount);
            }
        }).catch(function (e) {
            module.log.error(e);
        });
    };

    ConversationView.prototype.loadUpdate = function () {
        var $lastEntry = this.$.find('.mail-conversation-entry:not(.own):last');
        var lastEntryId = $lastEntry.data('entry-id');
        var data = {id: this.getActiveMessageId(), from: lastEntryId};

        var that = this;
        client.get(this.options.loadUpdateUrl, {data: data}).then(function (response) {
            if (response.html) {
                $(response.html).each(function () {
                    that.appendEntry($(this));
                });
            }
        })
    };

    ConversationView.prototype.reply = function (evt) {
        var that = this;
        client.submit(evt).then(function (response) {
            if (response.success) {
                that.appendEntry(response.content).then(function() {
                    that.$.find(".time").timeago(); // somehow this is not triggered after reply
                    var richtext = that.getReplyRichtext();
                    if (richtext) {
                        richtext.$.trigger('clear');
                    }
                    that.scrollToBottom();
                    if(!view.isSmall() && !view.isMedium()) { // prevent autofocus on mobile
                        that.focus();
                    }
                    Widget.instance('#inbox').updateEntries([that.getActiveMessageId()]);
                    that.setLivePollInterval();
                });
            } else {
                module.log.error(response, true);
            }
        }).catch(function (e) {
            module.log.error(e, true);
        }).finally(function (e) {
            loader.reset($('.reply-button'));
            evt.finish();
        });
    };

    ConversationView.prototype.setLivePollInterval = function () {
        require('live').setDelay(5);
    };

    ConversationView.prototype.getReplyRichtext = function () {
        return Widget.instance(this.$.find('.ProsemirrorEditor'));
    };


    ConversationView.prototype.focus = function (evt) {
        if (view.isSmall() || view.isMedium()) {
            return Promise.resolve();
        }
        var replyRichtext = this.getReplyRichtext();
        if (replyRichtext) {
            replyRichtext.focus();
        }
    };

    ConversationView.prototype.canLoadMore = function () {
        return !this.options.isLast;
    };

    ConversationView.prototype.reload = function () {
        if (this.getActiveMessageId()) {
            this.loadMessage(this.getActiveMessageId());
        }
    };

    ConversationView.prototype.addUser = function (evt) {
        var that = this;

        client.submit(evt).then(function (response) {
            if (response.result) {
                that.$.find('#mail-conversation-header').html(response.result);
            } else if (response.error) {
                module.log.error(response, true);
            }
        }).catch(function (e) {
            module.log.error(e, true);
        });
    };

    ConversationView.prototype.appendEntry = function (html) {
        var that = this;
        var $html = $(html);

        if (that.$.find('[data-entry-id="' + $html.data('entryId') + '"]').length) {
            return Promise.resolve();
        }

        // Filter out all script/links and text nodes
        var $elements = $html.not('script, link').filter(function () {
            return this.nodeType === 1; // filter out text nodes
        });

        // We use opacity because some additions require the actual size of the elements.
        $elements.css('opacity', 0);

        // call insert callback
        this.getListNode().append($html);

        return new Promise(function(resolve, reject) {
            $elements.css('opacity', 1).fadeIn('fast', function () {
                that.onUpdate();
                setTimeout(function() {that.scrollToBottom()}, 100);
                resolve();
            });
        })
    };

    ConversationView.prototype.loadMessage = function (evt) {
        (view.isSmall() || view.isMedium()) && $('.messages').addClass('shown');
        var messageId = object.isNumber(evt) ? evt : evt.$trigger.data('message-id');
        var that = this;
        this.loader();
        client.get(this.options.loadMessageUrl, {data: {id: messageId}}).then(function (response) {
            that.setActiveMessageId(messageId);
            that.options.isLast = false;

            var inbox = Widget.instance('#inbox');
            inbox.updateActiveItem();

            // Replace history state only if triggered by message preview item
            if (evt.$trigger && history && history.replaceState) {
                var url = evt.$trigger.data('action-url');
                if (url) {
                    history.replaceState(null, null, url);
                }
            }

            that.$.css('visibility', 'hidden');
            return that.updateContent(response.html);
        }).then(function () {
            return that.initScroll();
        }).catch(function (e) {
            module.log.error(e, true);
        }).finally(function () {
            that.scrollToBottom()
            that.loader(false);
            that.$.css('visibility', 'visible');
            that.initReplyRichText();

            const $chatTitleWrap = $('.chat-title-wrap')
            const $textTitle = $chatTitleWrap.children('span')
            that.makeScrollable($chatTitleWrap, $textTitle)

            const $occupationWrap = $('.chat-occupation-wrap')
            const $occupationText = $occupationWrap.children('.rocketcore-user-occupation')
            $occupationWrap.on('mouseenter', function() {
                that.makeScrollable($occupationWrap, $occupationText, false)
            })
            $occupationWrap.on('mouseleave').on('mouseleave', function() {
                $occupationWrap.animate({scrollLeft: 0}, 3500)
            })
        });
    };

    ConversationView.prototype.makeScrollable = function ($wrap, $textNode, looped = true, scrollDelay = 1500, scrollDuration = 3500) {
        if ($wrap.innerWidth() < $textNode.innerWidth()) {
            const offsetLeft = $wrap.offset().left

            const scrollLoopTitle = () => {
                setTimeout(() => {
                    $wrap.animate({scrollLeft: offsetLeft}, scrollDuration, () => {
                        setTimeout(() => $wrap.animate({scrollLeft: 0}, scrollDuration, function() {
                            if (looped) {
                                scrollLoopTitle()
                            }
                        }), scrollDelay)
                    })
                }, scrollDelay)
            }
            scrollLoopTitle()
        }
    }

    ConversationView.prototype.initReplyRichText = function () {
        var that = this;

        if(window.ResizeObserver) {
            var resizeObserver = new ResizeObserver(function(entries) {
                that.updateSize(that.isScrolledToBottom(100));
            });

            var replyRichtext = that.getReplyRichtext();
            if (replyRichtext) {
                resizeObserver.observe(replyRichtext.$[0]);
            }
        }

        that.focus();

    };

    ConversationView.prototype.isScrolledToBottom = function (tolerance) {
        var $list = this.getListNode();

        if(!$list.length) {
            return false;
        }

        tolerance = tolerance || 0;
        var list = this.getListNode()[0];
        return list.scrollHeight - list.offsetHeight - list.scrollTop <= tolerance;
    };

    ConversationView.prototype.initScroll = function () {
        if (window.IntersectionObserver) {
            var $entryList = this.$.find('.conversation-entry-list');
            var $streamEnd = $('<div class="conversation-stream-end"></div>');
            $entryList.prepend($streamEnd);

            var that = this;
            var observer = new IntersectionObserver(function (entries) {
                if (that.preventScrollLoading()) {
                    return;
                }

                if (entries.length && entries[0].isIntersecting) {
                    loader.prepend($entryList);
                    that.loadMore().finally(function () {
                        loader.reset($entryList);
                        that.scrollToBottom()
                    });
                }

            }, {root: $entryList[0], rootMargin: "50px"});

            // Assure the conversation list is scrollable by loading more entries until overflow
            return this.assureScroll().then(function () {
                observer.observe($streamEnd[0]);
                if(view.isLarge()) {
                    that.getListNode().niceScroll({
                        cursorwidth: "7",
                        cursorborder: "",
                        cursorcolor: "#555",
                        cursoropacitymax: "0.2",
                        nativeparentscrolling: false,
                        railpadding: {top: 0, right: 0, left: 0, bottom: 0}
                    });
                }
            });
        }
    };

    ConversationView.prototype.loadMore = function () {
        var that = this;

        var data = {
            id: this.getActiveMessageId(),
            from: this.$.find('.mail-conversation-entry:first').data('entryId')
        };

        return client.get(this.options.loadMoreUrl, {data: data}).then(function (response) {
            if (response.result) {
                var $result = $(response.result).hide();
                that.$.find('.conversation-entry-list').find('.conversation-stream-end').after($result);
                $result.fadeIn();
            }

            that.options.isLast = !response.result || response.isLast;
        }).catch(function (err) {
            module.log.error(err, true);
        });
    };

    ConversationView.prototype.preventScrollLoading = function () {
        return this.scrollLock || !this.canLoadMore();
    };

    ConversationView.prototype.canLoadMore = function () {
        return !this.options.isLast;
    };

    ConversationView.prototype.assureScroll = function () {
        var that = this;
        var $entryList = this.$.find('.conversation-entry-list');
        if ($entryList[0].offsetHeight >= $entryList[0].scrollHeight && this.canLoadMore()) {
            return this.loadMore().then(function () {
                return that.assureScroll();
            }).catch(function () {
                return Promise.resolve();
            })
        }

        return that.scrollToBottom();
    };

    ConversationView.prototype.updateContent = function (html) {
        var that = this;
        return new Promise(function (resolve) {
            that.$.html(html);
            resolve();
        });
    };


    ConversationView.prototype.getActiveMessageId = function () {
        return this.options.messageId;
    };

    ConversationView.prototype.setActiveMessageId = function (id) {
        this.options.messageId = id;
    };

    ConversationView.prototype.scrollToBottom = function () {
        var that = this;

        return new Promise(function (resolve) {
            setTimeout(function() {
                that.$.imagesLoaded(function() {
                    var $list = that.getListNode();
                    if(!$list.length) {
                        return;
                    }

                    that.updateSize(false).then(function () {
                        $list.scrollTop($list[0].scrollHeight)
                        setTimeout(() => {
                            if (!that.isScrolledToBottom(100)) {
                                return that.scrollToBottom()
                            }
                        }, 100)
                        resolve()
                    });
                })
            });
        });
    };

    ConversationView.prototype.updateSize = function (scrollToButtom) {
        var that = this;
        return new Promise(function (resolve) {
            setTimeout(function () {
                var $entryContainer = that.$.find('.conversation-entry-list');

                if (!$entryContainer.length) {
                    return;
                }

                var replyRichtext = that.getReplyRichtext();
                var formHeight = replyRichtext ? replyRichtext.$.innerHeight() : 0;
                $entryContainer.css('margin-bottom' , formHeight + 5 + 'px');

                var offsetTop = that.$.find('.conversation-entry-list').offset().top;
                var max_height = (window.innerHeight - offsetTop - formHeight - ((view.isSmall() || view.isMedium()) ? 20 : 30)) + 'px';
                $entryContainer.css('height', max_height);
                $entryContainer.css('max-height', max_height);

                if(scrollToButtom !== false) {
                    that.scrollToBottom();
                }
                resolve();
            }, 100);
        })

    };

    ConversationView.prototype.getListNode = function () {
        return this.$.find('.conversation-entry-list');
    };

    ConversationView.prototype.onUpdate = function () {
        if(view.isLarge()) {
            this.getListNode().getNiceScroll().resize();
        }
    };

    ConversationView.prototype.isLastMessageMine = function () {
        return this.$.find('.mail-conversation-entry').last().hasClass('own');
    }

    const removeIdFromUrl = function () {
        const url = new URL(window.location);
        url.searchParams.delete('id');
        window.history.pushState({}, '', url);
    }

    ConversationView.prototype.close = function () {
        this.setActiveMessageId(null);
        Widget.instance('#inbox').updateActiveItem();
        this.$.html('');
        removeIdFromUrl();

        if (view.isSmall() || view.isMedium()) {  // is mobile
            mailMobile.closeConversation();
        }
    }

    ConversationView.prototype.detectOpenedDialog = function() {
        if (view.isSmall() || view.isMedium()) {
            const queryParams = new URLSearchParams(window.location.search)
            if (queryParams.has('id')) {
                const dialogId = queryParams.get('id')
                $('.messages').addClass('shown');
                this.loadMessage(parseInt(dialogId))
            }
        }
    }

    module.export = ConversationView;
});

humhub.module('mail.ConversationEntry', function (module, require, $) {

    var Widget = require('ui.widget').Widget;

    var ConversationEntry = Widget.extend();

    ConversationEntry.prototype.replace = function (dom) {
        var that = this;
        var $content = $(dom).hide();
        this.$.fadeOut(function () {
            $(this).replaceWith($content);
            that.$ = $content;
            that.$.fadeIn('slow');
        });
    };

    ConversationEntry.prototype.remove = function () {
        this.$.fadeToggle('slow', function () {
            $(this).remove();
        });
    };

    module.export = ConversationEntry;
});
humhub.module('mail.inbox', function (module, require, $) {

    var Widget = require('ui.widget').Widget;
    var Filter = require('ui.filter').Filter;
    var view = require('ui.view');
    var loader = require('ui.loader');
    var client = require('client');

    var ConversationFilter = Filter.extend();

    ConversationFilter.prototype.triggerChange = function() {
        this.super('triggerChange');
        this.updateFilterCount();
    };

    ConversationFilter.prototype.updateFilterCount = function () {
        var count = this.getActiveFilterCount();

        var $filterToggle = this.$.find('#conversation-filter-link');
        var $filterCount = $filterToggle.find('.filterCount');

        if(count) {
            if(!$filterCount.length) {
                $filterCount = $('<small class="filterCount"></small>').insertBefore($filterToggle.find('.caret'));
            }
            $filterCount.html(' <b>('+count+')</b> ');
        } else if($filterCount.length) {
            $filterCount.remove();
        }
    };

    var ConversationList = Widget.extend();

    ConversationList.prototype.init = function () {
        this.filter = Widget.instance('#mail-filter-root');

        this.initScroll();

        var that = this;
        this.filter.off('afterChange.inbox').on('afterChange.inbox', function () {
            that.reload().then(function() {
                that.updateActiveItem();
            });
        });

        if(view.isLarge()) {
            this.$.niceScroll({
                cursorwidth: "7",
                cursorborder: "",
                cursorcolor: "#555",
                cursoropacitymax: "0.2",
                nativeparentscrolling: false,
                railpadding: {top: 0, right: 3, left: 0, bottom: 0}
            });
        }

        this.$.on('click', '.entry', function() {
            that.$.find('.entry').removeClass('selected');
            $(this).addClass('selected');
        })

    };

    ConversationList.prototype.updateEntries = function(ids) {
        var that = this;

        if(!ids.length) {
            return;
        }

        client.get(this.options.updateEntriesUrl, {data: {ids: ids}}).then(function(response) {
            if(!response.result)  {
                return;
            }

            $.each(response.result, function(id, html) {
                var $entry = that.getEntry(id);
                if(!$entry.length) {
                    $(html).prependTo(that.$) ;
                } else {
                   $entry.replaceWith(html);
                }
            });

            that.updateActiveItem();
        }).catch(function(e) {
            module.log.error(e);
        });
    };

    ConversationList.prototype.getEntry = function(id) {
        return this.$.find('[data-message-preview="'+id+'"]');
    };

    ConversationList.prototype.initScroll = function() {
        if (window.IntersectionObserver) {

            var $streamEnd = $('<div class="inbox-stream-end"></div>');
            this.$.append($streamEnd);

            var that = this;
            var observer = new IntersectionObserver(function (entries) {
                if (that.preventScrollLoading()) {
                    return;
                }

                if (entries.length && entries[0].isIntersecting) {
                    loader.append(that.$);
                    that.loadMore().finally(function() {
                        loader.reset(that.$);
                    });
                }

            }, {root: this.$[0], rootMargin: "50px"});

            // Assure the conversation list is scrollable by loading more entries until overflow
            this.assureScroll().then(function() {
                observer.observe($streamEnd[0]);
            });
        }

        // Force remove preventing scroll after select2 close. Select2 bug?
        $('.filterInput').off('select2:close').on('select2:close', function (e) {
            const evt = "scroll.select2";
            $(e.target).parents().off(evt);
            $(window).off(evt);
        });
    };

    ConversationList.prototype.assureScroll = function () {
        var that = this;
        if(this.$[0].offsetHeight >= this.$[0].scrollHeight && this.canLoadMore()) {
            this.scrollLock = true;
            return this.loadMore().then(function() {
                return that.assureScroll();
            }).catch(function () {
                return Promise.resolve();
            })
        }

        return Promise.resolve();
    };

    ConversationList.prototype.loadMore = function () {
        var that = this;
        return new Promise(function(resolve, reject) {
            var data = that.filter.getFilterMap();
            data.from = that.getLastMessageId();
            client.get(that.options.loadMoreUrl, {data: data}).then(function(response) {
                if(response.result) {
                    $(response.result).insertBefore('.inbox-stream-end');
                    that.$.find('.inbox-stream-end').append();
                }

                that.options.isLast = !response.result || response.isLast;
                that.updateActiveItem();

                resolve();
            }).catch(function(err) {
                module.log.error(err, true);
                reject();
            }).finally(function() {
                that.scrollLock = false;
            });
        });

    };

    ConversationList.prototype.preventScrollLoading = function () {
        return this.scrollLock || !this.canLoadMore();
    };

    ConversationList.prototype.canLoadMore = function () {
        return !this.options.isLast;
    };

    ConversationList.prototype.getReloadOptions = function () {
        return {data: this.filter.getFilterMap()};
    };

    ConversationList.prototype.updateActiveItem = function() {
        if (Widget.instance('#mail-conversation-root') === null) {
            return;
        }

        var activeMessageId = Widget.instance('#mail-conversation-root').getActiveMessageId();

        this.$.find('.entry').removeClass('selected');

        // Remove New badge from current selection
        this.$.find('.entry.selected').find('.new-message-badge').hide();

        // Set new selection
        this.$.find('.entry').removeClass('selected');
        var $selected = this.$.find('[data-message-preview="' + activeMessageId + '"]');

        if($selected.length) {
            $selected.removeClass('unread').addClass('selected').find('.new-message-badge').hide();
            $selected.find('.chat-count').hide();
        }
    };


    ConversationList.prototype.getFirstMessageId = function() {
        return this.$.find('.entry:first').data('messagePreview');
    };

    ConversationList.prototype.getLastMessageId = function() {
        return this.$.find('.entry:last').data('messagePreview');
    };

    ConversationList.prototype.hide = function() {
        var inboxWrapper = $('.inbox-wrapper');
        return new Promise(function (resolve) {
            if (view.isSmall() && inboxWrapper.length) {
                if($('#mail-conversation-root').length) {
                    Widget.instance('#mail-conversation-root').updateSize();
                }
            }
            resolve();
        });
    };

    ConversationList.prototype.show = function() {
        var inboxWrapper = $('.inbox-wrapper');
        return new Promise(function (resolve) {
            if (view.isSmall() && inboxWrapper.length) {
                if($('#mail-conversation-root').length) {
                    Widget.instance('#mail-conversation-root').updateSize();
                }
            }
            resolve();
        });
    };

    var toggleInbox = function() {};

    var setTagFilter = function (evt) {
        Widget.instance('#inbox').show().then(function() {
            $('#mail-filter-menu').collapse('show');
            Widget.instance('#inbox-tag-picker').setSelection([{
                id: evt.$trigger.data('tagId'),
                text: evt.$trigger.data('tagName'),
                image: evt.$trigger.data('tagImage'),
            }]);
        });
    };

    module.export({
        ConversationList: ConversationList,
        Filter: ConversationFilter,
        setTagFilter: setTagFilter,
        toggleInbox: toggleInbox
    });
});

humhub.module('mail.conversation', function (module, require, $) {

    var Widget = require('ui.widget').Widget;
    var modal = require('ui.modal');
    var client = require('client');
    var event = require('event');
    var mail = require('mail.notification');
    var user = require('user');

    var submitEditEntry = function (evt) {
        modal.submit(evt).then(function (response) {
            if (response.success) {
                var entry = getEntry(evt.$trigger.data('entry-id'));
                if (entry) {
                    setTimeout(function () {
                        entry.replace(response.content);
                    }, 300)
                }

                return;
            }

            module.log.error(null, true);
        }).catch(function (e) {
            module.log.error(e, true);
        });
    };

    var deleteEntry = function (evt) {
        var entry = getEntry(evt.$trigger.data('entry-id'));

        if (!entry) {
            module.log.error(null, true);
            return;
        }

        client.post(entry.options.deleteUrl).then(function (response) {
            modal.global.close();

            if (response.success) {
                setTimeout(function () {
                    entry.remove();
                }, 1000);
            }
        }).catch(function (e) {
            module.log.error(e, true);
        });
    };

    var getEntry = function (id) {
        return Widget.instance('.mail-conversation-entry[data-entry-id="' + id + '"]');
    };

    var getRootView = function () {
        return Widget.instance('#mail-conversation-root');
    };

    var init = function () {
        event.on('humhub:modules:mail:live:NewUserMessage', function (evt, events) {
            if(!$('#inbox').length) {
                return;
            }

            var root = getRootView();
            var updated = false;
            var updatedMessages = [];
            events.forEach(function (event) {
                var isOwn = event.data['user_guid'] == user.guid();
                updatedMessages.push(event.data.message_id);
                if (!updated && root && root.options.messageId == event.data.message_id) {
                    root.loadUpdate();
                    updated = true;
                    root.markSeen(event.data.message_id);
                } else if (!isOwn && root) {
                    var $entry = getOverViewEntry(event.data.message_id);
                    if(!$entry.is('.selected')) {
                        $entry.find('.new-message-badge').show();
                    }
                }
            });

            Widget.instance('#inbox').updateEntries(updatedMessages);
        }).on('humhub:modules:mail:live:UserMessageDeleted', function (evt, events, update) {
            if(!$('#inbox').length) {
                return;
            }

            events.forEach(function (event) {
                var entry = getEntry(event.data.entry_id);
                if (entry) {
                    entry.remove();
                }
                mail.setMailMessageCount(event.data.count);
            });
        });
    };

    var getOverViewEntry = function (id) {
        return $('#mail-conversation-overview').find('[data-message-preview="' + id + '"]');
    };

    var leave = function (evt) {
        client.post(evt).then(function (response) {
            if (response.redirect) {
                client.pjax.redirect(response.redirect);
            }
        }).catch(function (e) {
            module.log.error(e, true);
        });
    };

    module.export({
        init: init,
        leave: leave,
        submitEditEntry: submitEditEntry,
        deleteEntry: deleteEntry,
    });
});
humhub.module('mail.reply', function(module, require, $) {
    var selector = {
        messagesRoot: '#mail-conversation-root',
        replyButton: '.rocketmailreply-btn',
        convEntry: '.mail-conversation-entry',
        convEntryContent: '.mail-conversation-entry .content',
        convEntriesList: '.conversation-entry-list',
        mailAddonRoot: '.rocketcore-mail-addon-container',
        mailAddonRootEntry: '.rocketcore-mail-addon-entry',
        replyBtn: '.rocketmailreply-btn',
        editor: '.ProsemirrorEditor',
        messageDom: '[data-ui-richtext]',
    };

    var REPLY_MAX_LENGTH = 256;

    var Widget = require('ui.widget').Widget;
    var RichText = require('ui.richtext');
    var url = require('util').url;
    var MailReplyButton = Widget.extend();

    MailReplyButton.prototype.init = function() {
        this.api = PMApi;
        this.editor = this._getEditor();
        this.domParser = this.api.model.DOMParser.fromSchema(this.editor.view.state.schema);
    };

    MailReplyButton.prototype.handle = function() {
        this.clearEditor();
        this.pasteEditor(this.getReplyCut());
        this.fixEmptyBlock();
        this.focusEditor();
    };

    MailReplyButton.prototype.pasteEditor = function(content, pos = 1) {
        var $tr = this.editor.view.state.tr.insert(pos, content);
        this.editor.view.dispatch($tr);
    }

    MailReplyButton.prototype.fixEmptyBlock = function() {
        var view = this.editor.view;
        var doc = view.state.doc;
        view.dispatch(
            view.state.tr.setSelection(
                this.api.state.TextSelection.near(doc.resolve(doc.content.size - 4))
            )
        );
        this.api.commands.joinBackward(view.state, view.dispatch, view);
        // this.api.commands.liftEmptyBlock(view.state, view.dispatch);
    };

    MailReplyButton.prototype.clearEditor = function() {
        this.editor.clear();
        var $tr = this.editor.view.state.tr.insert(
            0,
            this.editor.parser.parse('>')
        );
        this.editor.view.dispatch($tr);
    };

    MailReplyButton.prototype.focusEditor = function() {
        var selection = this.api.state.Selection.atEnd(this.editor.view.state.doc);
        var $tr = this.editor.view.state.tr.setSelection(selection);
        this.editor.view.focus();
        this.editor.view.dispatch($tr.scrollIntoView());
    };

    MailReplyButton.prototype.getNodesContent = function() {
        return this.domParser.parse(this._getDomNode());
    };

    MailReplyButton.prototype.getReplyCut = function() {
        var node = this.stripBlockquoteFromBeginning(this.getNodesContent());
        if (node.nodeSize < REPLY_MAX_LENGTH) {
            return node;
        }
        var nodeCut = node.cut(0, REPLY_MAX_LENGTH);
        var schema = this.editor.view.state.schema;
        var ellipsisNode = schema.node('paragraph', null, [schema.text('...')]);
        return nodeCut.content.addToEnd(ellipsisNode);
    };

    MailReplyButton.prototype.stripBlockquoteFromBeginning = function(node) {
        if (node.content.size && node.content.content[0].type.name === 'blockquote') {
            return node.cut(node.content.content[0].nodeSize);
        }
        return node;
    };

    MailReplyButton.prototype._getEditor = function() {
        return Widget.instance($(selector.messagesRoot).find(selector.editor)).editor;
    };

    MailReplyButton.prototype._getDomNode = function() {
        return this.$.closest(selector.convEntryContent).find(selector.messageDom)[0];
    };

    var MailReply = Widget.extend();
    MailReply.prototype.init = function () {
        this.originalMessageId = this._findOriginalMessageId();
    };

    MailReply.prototype.scrollToOriginalMessage = function () {
    };

    MailReply.prototype._findOriginalMessageId = function () {
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

    module.export({
        initOnPjaxLoad: true,
        init: init,
        initReplyButton: initReplyButton,
        MailReply: MailReply,
        MailReplyButton: MailReplyButton,
    });
});

humhub.module('mail.draft', function(module, require, $) {
    var selector = {
        messagesRoot: '#mail-conversation-root',
        editor: '.ProsemirrorEditor',
        selectedConversation: '.messagePreviewEntry.selected',
        submitButton: '.reply-button'
    };

    var EVENT_DRAFT_CHANGED = 'mail:draft:changed';
    var Widget = require('ui.widget').Widget;
    var url = require('util').url;
    var RichText = require('ui.richtext');

    function throttle(fn, timeout) {
        var timer = null;
        return function () {
            if (!timer) {
                timer = setTimeout(function() {
                    fn();
                    timer = null;
                }, timeout);
            }
        };
    }

    var DraftsStorage = function() {
        this.key = 'mail:conversation:drafts';
        this.internalStorage = window.localStorage || window.sessionStorage;
        if (this.internalStorage.getItem(this.key) === null) {
            this._saveList({});
        }
    };

    DraftsStorage.prototype.get = function(convId) {
        var list = this._getList();
        return list[convId] || null;
    };

    DraftsStorage.prototype.set = function(convId, draft) {
        var list = this._getList();
        $(document).trigger(EVENT_DRAFT_CHANGED, [convId, draft, list]);
        list[convId] = draft;
        this._saveList(list);
    };

    DraftsStorage.prototype.unset = function(convId) {
        var list = this._getList();
        if (typeof list[convId] !== undefined) {
            delete list[convId];
            this._saveList(list);
        }
    };

    DraftsStorage.prototype._getList = function() {
        return JSON.parse(this.internalStorage.getItem(this.key));
    };

    DraftsStorage.prototype._saveList = function(list) {
        this.internalStorage.setItem(this.key, JSON.stringify(list));
    };

    var getEditorWidget = function() {
        return Widget.instance($(selector.messagesRoot).find(selector.editor));
    };

    var isValidPage = function() {
        var requestParam = url.getUrlParameter('r');
        return (requestParam && decodeURIComponent(requestParam).indexOf('mail/mail') > -1) ||
            location.pathname.indexOf('mail/mail') > -1;
    };

    var getSelectedConversationId = function() {
        return Widget.instance(selector.messagesRoot).getActiveMessageId();
    };

    var shouldLoadDraft = function(mutations) {
        var addedNodes = [];
        var globalReload = false;
        $(mutations).each(function(idx, mutation) {
            if (mutation.addedNodes.length) {
                addedNodes = addedNodes.concat(Array.from(mutation.addedNodes));
            }
        });
        if (addedNodes.length) {
            $(addedNodes).each(function(idx, node) {
                if ($(node).is('.mail-conversation') || $(node).is('.mail-aside')) {
                    return globalReload = true;
                }
            });
        }

        return globalReload && getEditorWidget();
    }

    var loadDraft = function(mutations) {
        if (!shouldLoadDraft(mutations)) return;
        var editor = getEditorWidget().editor;
        var view = editor.view;
        var convId = getSelectedConversationId();
        var draft = getConversationDraft(convId);
        if (draft && editor.isEmpty()) {
            var $tr = editor.view.state.tr.insert(
                0,
                editor.parser.parse(draft)
            );
            editor.view.dispatch($tr);
            PMApi.commands.joinBackward(view.state, view.dispatch, view);
        }

        editor.on('keyup mouseup', throttle(function () {
            var draft = editor.serializer.serialize(editor.view.state.doc);
            storage.set(convId, draft);
        }, 1000));

        editor.$.on('clear', function() {
            storage.unset(convId);
        });
    };

    var storage;
    var mutationObserver;
    var draftsObserver;
    var PMApi;
    var initialized = false;
    var init = function() {
        if (!isValidPage()) {
            if (initialized) {
                return cleanUp();
            }
            return false;
        }
        if (initialized) {
            cleanUp();
        }
        var $messagesRoot = $(selector.messagesRoot);
        if (!mutationObserver) {
            mutationObserver = new MutationObserver(loadDraft)
        }

        PMApi = RichText.prosemirror.api;
        storage = new DraftsStorage();
        mutationObserver.observe($messagesRoot[0], { childList: true, subtree: true });
        draftsObserver = function(ev, convId) {
            module.log.debug("Draft #" + convId + " just changed");
        };
        $(document).on(EVENT_DRAFT_CHANGED, draftsObserver);
        initialized = true;
    };

    var cleanUp = function() {
        if (mutationObserver) {
            mutationObserver.disconnect();
        }
        if (draftsObserver) {
            $(document).off(EVENT_DRAFT_CHANGED, draftsObserver);
        }
        initialized = false;
    };

    var getConversationDraft = function (convId) {
        return storage.get(convId);
    };

    module.export({
        initOnPjaxLoad: true,
        init: init,
        DraftsStorage: DraftsStorage,
    });
});

humhub.module('mail.mobile', function (module, require, $) {
    var ID_MAIL_BREADCRUMBS = 'mail-breadcrumbs';

    var Widget = require('ui.widget').Widget;
    var view = require('ui.view');
    var url = require('util').url;

    var MailBreadcrumbs = Widget.extend();

    var closeConversation = function (evt) {
        if (evt) {
            evt.preventDefault();
        }
        $('.messages').removeClass('shown');
        MailBreadcrumbs.prototype.hideBackButton();
    }

    var closeConversationMobile = function (evt) {
        Widget.instance('#mail-conversation-root').close(evt);
    }

    MailBreadcrumbs.prototype.getButton = function () {
        return $(this.anchor);
    };

    MailBreadcrumbs.prototype.hideBackButton = function () {
        this.getButton().hide();
    };

    var injectMailBreadcrumbs = function () {
        var $parent = $('.mails-header');
        if (!$parent.length || $('#' + ID_MAIL_BREADCRUMBS).length) return;
        var divEl = document.createElement('div');
        divEl.id = ID_MAIL_BREADCRUMBS;
        divEl.dataset.uiWidget = "mail.mobile.MailBreadcrumbs";
        $parent.append(divEl);
        Widget.instance(divEl);
    };

    var fixBodyHeight = function() {
        if (isValidPage()) {
            $(window).on('resize', resizeHandler);
            resizeHandler();
        } else {
            $(window).off('resize', resizeHandler);
        }
    };

    var resizeHandler = function() {
        $(document.body).toggleClass('rocket-mobile-body', isMobileView() && isValidPage());
    };

    var isValidPage = function() {
        var requestParam = url.getUrlParameter('r');
        return (requestParam && decodeURIComponent(requestParam).indexOf('mail/mail') > -1) ||
            location.pathname.indexOf('mail/mail') > -1;
    };

    var isMobileView = function () {
        return view.isSmall();
    };

    var init = function () {
        injectMailBreadcrumbs();
        fixBodyHeight();
    };

    module.export({
        init: init,
        MailBreadcrumbs: MailBreadcrumbs,
        closeConversation: closeConversation,
        closeConversationMobile: closeConversationMobile
    });
});

humhub.module('mail.filter.unread', function(module, require, $) {

    var Widget = module.require('ui.widget').Widget;
    var Filter = require('ui.filter').Filter;

    var MyFilter = Filter.extend();

    MyFilter.prototype.init = function() {
        this.cosmeticCheckbox = this.$.find('#rocketmailfilter-unread-toggle');
        this.hiddenInput = this.$.find('[name=unread]');
        this.inputContainer = this.cosmeticCheckbox.closest('#rocketmailfilter-root');
        this.mailFilterForm = Widget.instance('#mail-filter-root').$.find('form');
        this.placeUnreadCheckbox();
        this.attachListeners();
    };

    MyFilter.prototype.placeUnreadCheckbox = function() {
        this.mailFilterForm.prepend(this.$.detach());
        this.$.removeClass('hidden');
    }

    MyFilter.prototype.attachListeners = function() {
        var self = this;
        this.cosmeticCheckbox.on('change', function() {
            self.toggleInputValue();
            if (self.isChecked()) {
                self.activateHiddenInput();
            } else {
                self.deactivateHiddenInput();
            }
            Widget.instance('#mail-filter-root').triggerChange();
            Widget.instance('#mail-conversation-root').close();
        });
    };

    MyFilter.prototype.toggleInputValue = function() {
        this.hiddenInput.val(this.isChecked() ? '1' : '0');
    }

    MyFilter.prototype.isChecked = function () {
        return this.cosmeticCheckbox.prop('checked');
    }

    MyFilter.prototype.activateHiddenInput = function () {
        this.inputContainer.prepend(this.hiddenInput);
    }

    MyFilter.prototype.deactivateHiddenInput = function () {
        this.hiddenInput.remove();
    }

    module.export = MyFilter;
});

humhub.module('mail.UserList', function(module, require, $) {
    const selectors = {
        form: '#chat-user-list-form',
        filter: 'input[name="UserFilter[filter]"]'
    };
    const modal = require('ui.modal');
    const client = require('client');

    const filter = function () {
        const $form = $(selectors.form);
        let formData = {};
        if ($form) {
            formData = $form.serializeArray();
        }

        modal.global.post(module.config['userListUrl'], { data: formData });
    }

    const clear = function () {
        $(selectors.filter).val('');
        modal.global.post(module.config['userListUrl'], { data: {} });
    }

    const remove = function (evt) {
        client
            .get(module.config['removeParticipantUrl'] + `?id=${evt.params.conversationId}&userId=${evt.params.userId}`)
            .then(() => {filter()});
    }

    module.export({
        filter: filter,
        clear: clear,
        remove: remove
    });
})
