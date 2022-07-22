<?php

use humhub\modules\mail\helpers\Url;
use humhub\modules\user\widgets\Image;
use humhub\widgets\ModalButton;
use humhub\modules\content\widgets\richtext\RichText;
use humhub\modules\mail\widgets\TimeAgo;
use humhub\libs\Html;

/* @var $entry \humhub\modules\mail\models\MessageEntry */
/* @var $badge boolean */

$isOwnMessage = $entry->user->is(Yii::$app->user->getIdentity());
$lastEntryId = $entry->message->lastEntry->id;

?>
<div class="message-reaction">
    <span class="reaction-1">❤️</span>
    <span class="reaction-2">🔥</span>
    <span class="reaction-3">👍</span>
    <span class="reaction-4">😢</span>
</div>
<?php if(($isOwnMessage && ($lastEntryId == $entry->id)) || ($isOwnMessage && Yii::$app->user->isAdmin())) : ?>
    <li class="edit">
        <?= ModalButton::none('' . Yii::t('custom', 'Редактировать') . '')->cssClass('conversation-edit-button')->load(Url::toEditMessageEntry($entry))->link() ?>
    </li>
<?php endif ?>
