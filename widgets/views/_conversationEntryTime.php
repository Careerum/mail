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

<?=TimeAgo::widget(['timestamp' => $entry->created_at, 'badge' => $badge]) ?>
