<?php

use humhub\libs\Html;
use humhub\modules\mail\models\forms\ReplyForm;
use humhub\modules\mail\models\Message;
use humhub\modules\mail\widgets\ConversationHeader;
use humhub\modules\mail\widgets\ConversationTags;
use humhub\modules\mail\widgets\MailRichtextEditor;
use humhub\modules\mail\widgets\Messages;
use humhub\modules\ui\view\components\View;
use humhub\modules\ui\form\widgets\ActiveForm;
use humhub\widgets\Button;

/* @var $this View */
/* @var $replyForm ReplyForm */
/* @var $messageCount integer */
/* @var $message Message */
/* @var $hasDeactivated bool */

$countUsers = count($message->users);
?>

<?php if ($message === null) : ?>

<?php else :?>
    <div class="mail-conversation">
        <div class="header" id="mail-conversation-header">
            <div class="mail-mobile-control hidden-from-desktop">
                <div class="control-btn" id="mail-breadcrumbs" data-ui-widget="mail.mobile.MailBreadcrumbs" data-action-click="mail.mobile.closeConversationMobile">
                    <a href="#" class="icon"><svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 13L1 7L7 1" fill="#F4F4F4"/><path d="M7 13L1 7L7 1" stroke="#B4B4B4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
                </div>
            </div>
            <?= ConversationHeader::widget(['message' => $message]) ?>
        </div>

        <?= ConversationTags::widget(['message' => $message])?>

        <div class="content">
            <div class="media-list conversation-entry-list">
                <?= Messages::widget(['message' => $message])?>
            </div>
            <div class="to-end-button-container">
                <a href="#" class="to-last-message"></a>
            </div>
        </div>
        <div class="mail-editor">
            <div class="reply-container" data-ui-widget="mail.reply.MailReply" data-ui-init="1">
                <div class="reply">
                    <div class="reply-decoration"></div>
                    <div class="reply-info">
                        <div class="reply-author"></div>
                        <div class="reply-text"></div>
                    </div>
                    <div class="reply-detach">
                        <a href="#" id="reply-detach"><svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.3955 8.09473L7.60352 12.8867" stroke="#B4B4B4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M12.3976 12.8898L7.60156 8.09277" stroke="#B4B4B4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></path></svg></a>
                    </div>
                </div>
            </div>
            <?php if ($message->isBlocked()) : ?>
                <div class="alert alert-danger">
                    <?= Yii::t('MailModule.views_mail_show', 'You are not allowed to participate in this conversation. You have been blocked by: {userNames}.', [
                        'userNames' => implode(', ', $message->getBlockerNames())
                    ]); ?>
                </div>
            <?php elseif ($countUsers === 2 && $hasDeactivated) : ?>
                <?php $form = ActiveForm::begin(['enableClientValidation' => false]); ?>
                    <?= $form->field($replyForm, 'replyId')->hiddenInput()->label(false) ?>
                    <div class="form-textarea">
                        <?= $form->field($replyForm, 'message')->widget(MailRichtextEditor::class, ['id' => 'reply-'.time(), 'disabled' => true])->label(false) ?>
                    </div>
                    <div class="form-button">
                        <?= Button::defaultType(Yii::t('custom', '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.4066 5.59967L7.31915 10.7415L1.53283 7.12238C0.703778 6.60368 0.876236 5.34439 1.81397 5.07016L15.5522 1.0469C16.4109 0.795226 17.2067 1.59807 16.9516 2.45955L12.8872 16.1882C12.6087 17.1273 11.3566 17.2951 10.8428 16.4625L7.31645 10.7424" stroke="#B4B4B4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="stroke: #B4B4B4 !important;"/></svg>'))->cssClass('reply-button')->right()->sm()->cssClass('disabled')->loader(false) ?>
                    </div>
                <?php ActiveForm::end(); ?>
            <?php else : ?>
                <?php $form = ActiveForm::begin(['enableClientValidation' => false]); ?>
                    <?= $form->field($replyForm, 'replyId')->hiddenInput()->label(false) ?>
                    <div class="form-textarea">
                        <?= $form->field($replyForm, 'message')->widget(MailRichtextEditor::class, ['id' => 'reply-'.time()])->label(false) ?>
                    </div>
                    <div class="form-button">
                        <?= Button::defaultType(Yii::t('custom', '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.4066 5.59967L7.31915 10.7415L1.53283 7.12238C0.703778 6.60368 0.876236 5.34439 1.81397 5.07016L15.5522 1.0469C16.4109 0.795226 17.2067 1.59807 16.9516 2.45955L12.8872 16.1882C12.6087 17.1273 11.3566 17.2951 10.8428 16.4625L7.31645 10.7424" stroke="#F9754F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'))->cssClass('reply-button')->submit()->action('reply', $replyForm->getUrl())->right()->sm() ?>
                    </div>
                <?php ActiveForm::end(); ?>
            <?php endif; ?>
        </div>

        <script <?= Html::nonce() ?>>
            humhub.modules.mail.notification.setMailMessageCount(<?= $messageCount ?>);
        </script>
    </div>
<?php endif; ?>
